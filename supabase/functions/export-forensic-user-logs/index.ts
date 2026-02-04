import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForensicRequest {
  user_email: string;
  date_start: string;
  date_end: string;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
}

function formatBoolean(value: boolean | null): string {
  if (value === null || value === undefined) return '-';
  return value ? 'Sim' : 'Não';
}

function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

// Simple SHA256 hash for integrity verification
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[export-forensic-user-logs] Starting forensic export...');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No auth header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Validate caller is platform admin using getUser
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error('[export-forensic-user-logs] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerId = user.id;
    console.log('[export-forensic-user-logs] Caller ID:', callerId);
    
    // Use service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is platform admin
    const { data: isAdmin, error: adminError } = await supabase.rpc(
      'is_platform_admin_for_rls',
      { p_user_id: callerId }
    );

    console.log('[export-forensic-user-logs] Platform admin check:', { isAdmin, adminError });

    if (adminError || !isAdmin) {
      console.error('[export-forensic-user-logs] Caller is not platform admin:', callerId, 'Error:', adminError);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Platform Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request parameters
    const { user_email, date_start, date_end }: ForensicRequest = await req.json();

    if (!user_email || !date_start || !date_end) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: user_email, date_start, date_end' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[export-forensic-user-logs] Exporting for user: ${user_email}, period: ${date_start} to ${date_end}`);

    // Get user_id from profiles - first try profiles table
    let userId: string | null = null;
    let fullName: string | null = null;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', user_email)
      .single();

    if (profile) {
      userId = profile.id;
      fullName = profile.full_name;
    }
    
    // Also check auth_audit_log for the user_id (sometimes they differ)
    const { data: authUser } = await supabase
      .from('auth_audit_log')
      .select('user_id')
      .eq('email', user_email)
      .not('user_id', 'is', null)
      .limit(1)
      .single();
    
    // Prefer auth_audit_log user_id if different (it's the actual auth.users id)
    const authUserId = authUser?.user_id;
    
    if (!userId && !authUserId) {
      console.error('[export-forensic-user-logs] User not found:', user_email);
      return new Response(
        JSON.stringify({ error: `User not found: ${user_email}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use both IDs for comprehensive search
    const primaryUserId = authUserId || userId!; // Primary search ID

    const dateEndPlusOne = new Date(date_end);
    dateEndPlusOne.setDate(dateEndPlusOne.getDate() + 1);
    const dateEndQuery = dateEndPlusOne.toISOString().split('T')[0];

    console.log(`[export-forensic-user-logs] User ID: ${primaryUserId}`);

    // Parallel queries for all data
    const [
      auditLogResult,
      authAuditLogResult,
      systemEventsResult,
      activitiesResult,
      opportunitiesResult
    ] = await Promise.all([
      // audit_log
      supabase
        .from('audit_log')
        .select('*')
        .eq('actor_user_id', primaryUserId)
        .gte('created_at', date_start)
        .lt('created_at', dateEndQuery)
        .order('created_at', { ascending: true }),
      
      // auth_audit_log
      supabase
        .from('auth_audit_log')
        .select('*')
        .eq('user_id', primaryUserId)
        .gte('created_at', date_start)
        .lt('created_at', dateEndQuery)
        .order('created_at', { ascending: true }),
      
      // system_events
      supabase
        .from('system_events')
        .select('*')
        .eq('actor_id', primaryUserId)
        .gte('created_at', date_start)
        .lt('created_at', dateEndQuery)
        .order('created_at', { ascending: true }),
      
      // activities
      supabase
        .from('activities')
        .select('*')
        .eq('owner_user_id', primaryUserId)
        .gte('created_at', date_start)
        .lt('created_at', dateEndQuery)
        .order('created_at', { ascending: true }),
      
      // opportunities
      supabase
        .from('opportunities')
        .select('*')
        .or(`owner_user_id.eq.${primaryUserId},created_by.eq.${primaryUserId}`)
        .gte('created_at', date_start)
        .lt('created_at', dateEndQuery)
        .order('created_at', { ascending: true })
    ]);

    const auditLog = auditLogResult.data || [];
    const authAuditLog = authAuditLogResult.data || [];
    const systemEvents = systemEventsResult.data || [];
    const activities = activitiesResult.data || [];
    const opportunities = opportunitiesResult.data || [];

    const totalRecords = auditLog.length + authAuditLog.length + systemEvents.length + 
                         activities.length + opportunities.length;

    console.log(`[export-forensic-user-logs] Records found: audit_log=${auditLog.length}, auth_audit_log=${authAuditLog.length}, system_events=${systemEvents.length}, activities=${activities.length}, opportunities=${opportunities.length}`);

    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    const generatedAt = new Date().toISOString();

    // 1. RESUMO sheet
    const resumoData = [
      { "Campo": "RELATÓRIO FORENSE - USO EXCLUSIVO JUDICIAL", "Valor": "" },
      { "Campo": "", "Valor": "" },
      { "Campo": "Usuário Investigado", "Valor": user_email },
      { "Campo": "Nome Completo", "Valor": fullName || '-' },
      { "Campo": "User ID", "Valor": primaryUserId },
      { "Campo": "Período Início", "Valor": date_start },
      { "Campo": "Período Fim", "Valor": date_end },
      { "Campo": "", "Valor": "" },
      { "Campo": "Total de Registros", "Valor": totalRecords },
      { "Campo": "  - Audit Log", "Valor": auditLog.length },
      { "Campo": "  - Auth Audit Log", "Valor": authAuditLog.length },
      { "Campo": "  - System Events", "Valor": systemEvents.length },
      { "Campo": "  - Activities", "Valor": activities.length },
      { "Campo": "  - Opportunities", "Valor": opportunities.length },
      { "Campo": "", "Valor": "" },
      { "Campo": "Gerado em (UTC)", "Valor": generatedAt },
      { "Campo": "Gerado por (Platform Admin)", "Valor": callerId },
      { "Campo": "", "Valor": "" },
      { "Campo": "AVISO LEGAL", "Valor": "Este relatório foi gerado para fins exclusivamente judiciais." },
      { "Campo": "", "Valor": "Os dados apresentados são uma extração fiel do sistema NOID RevenueOS." },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), "RESUMO");

    // 2. AUDIT_LOG sheet
    const auditLogFormatted = auditLog.map(row => ({
      "Data/Hora": formatDateTime(row.created_at),
      "Ação": row.action || '-',
      "Tipo Entidade": row.entity_type || '-',
      "ID Entidade": row.entity_id || '-',
      "Campo Alterado": row.field_name || '-',
      "Valor Anterior": stringifyJson(row.old_value),
      "Valor Novo": stringifyJson(row.new_value),
      "Trace ID": row.trace_id || '-',
      "Metadados": stringifyJson(row.metadata),
      "Organization ID": row.organization_id || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditLogFormatted.length ? auditLogFormatted : [{ "Info": "Nenhum registro encontrado" }]), "AUDIT_LOG");

    // 3. AUTH_LOG sheet
    const authLogFormatted = authAuditLog.map(row => ({
      "Data/Hora": formatDateTime(row.created_at),
      "Tipo Evento": row.event_type || '-',
      "Sucesso": formatBoolean(row.success),
      "Endereço IP": row.ip_address || '-',
      "Cidade": row.city || '-',
      "Região": row.region || '-',
      "País": row.country_name || '-',
      "ISP": row.isp || '-',
      "VPN": formatBoolean(row.is_vpn),
      "Proxy": formatBoolean(row.is_proxy),
      "User Agent": row.user_agent || '-',
      "Tipo Dispositivo": row.device_type || '-',
      "Resolução Tela": row.screen_resolution || '-',
      "Timezone": row.timezone || '-',
      "Idioma": row.language || '-',
      "URL Acessada": row.page_url || '-',
      "Email": row.email || '-',
      "Erro": row.error_message || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(authLogFormatted.length ? authLogFormatted : [{ "Info": "Nenhum registro encontrado" }]), "AUTH_LOG");

    // 4. SYSTEM_EVENTS sheet
    const systemEventsFormatted = systemEvents.map(row => ({
      "Data/Hora": formatDateTime(row.created_at),
      "Trace ID": row.trace_id || '-',
      "Categoria": row.event_category || '-',
      "Tipo Evento": row.event_type || '-',
      "Ação": row.action || '-',
      "Tipo Entidade": row.entity_type || '-',
      "ID Entidade": row.entity_id || '-',
      "Payload": stringifyJson(row.payload),
      "Organization ID": row.organization_id || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(systemEventsFormatted.length ? systemEventsFormatted : [{ "Info": "Nenhum registro encontrado" }]), "SYSTEM_EVENTS");

    // 5. ACTIVITIES sheet
    const activitiesFormatted = activities.map(row => ({
      "Data/Hora": formatDateTime(row.created_at),
      "Tipo": row.type || '-',
      "Título": row.title || '-',
      "Status": row.status || '-',
      "Descrição": row.description || '-',
      "Agendado Para": formatDateTime(row.scheduled_date),
      "Concluído Em": formatDateTime(row.completed_at),
      "Duração (min)": row.duration_minutes || '-',
      "Oportunidade ID": row.opportunity_id || '-',
      "Conta ID": row.account_id || '-',
      "Contato ID": row.contact_id || '-',
      "Automático": formatBoolean(row.is_automated),
      "Gerado por IA": formatBoolean(row.ai_generated),
      "Sentimento": row.sentiment || '-',
      "Organization ID": row.organization_id || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activitiesFormatted.length ? activitiesFormatted : [{ "Info": "Nenhum registro encontrado" }]), "ACTIVITIES");

    // 6. OPPORTUNITIES sheet
    const opportunitiesFormatted = opportunities.map(row => ({
      "Data/Hora Criação": formatDateTime(row.created_at),
      "Título": row.title || '-',
      "Valor Previsto": formatCurrency(row.valor_previsto),
      "Probabilidade (%)": row.prob || '-',
      "Status": row.status || '-',
      "Pipeline ID": row.pipeline_id || '-',
      "Estágio ID": row.stage_id || '-',
      "Temperatura": row.temperature || '-',
      "Score IA (%)": row.win_probability_ai || '-',
      "Tipo Lead": row.lead_type || '-',
      "Fechamento Previsto": formatDateTime(row.close_date_prevista),
      "Conta ID": row.account_id || '-',
      "Contato ID": row.contact_id || '-',
      "Motivo Perda": row.loss_reason || '-',
      "Organization ID": row.organization_id || '-',
      "Atualizado Em": formatDateTime(row.updated_at)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opportunitiesFormatted.length ? opportunitiesFormatted : [{ "Info": "Nenhum registro encontrado" }]), "OPPORTUNITIES");

    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    
    // Convert to base64
    const uint8Array = new Uint8Array(excelBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    // Generate integrity hash
    const integrityHash = await sha256(base64);

    const filename = `forensic_${user_email.replace(/[@.]/g, '_')}_${date_start}_to_${date_end}.xlsx`;

    console.log(`[export-forensic-user-logs] Export completed. Total records: ${totalRecords}, Hash: ${integrityHash.substring(0, 16)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        data: base64,
        metadata: {
          user_email,
          user_id: primaryUserId,
          user_name: fullName,
          period: `${date_start} to ${date_end}`,
          generated_at: generatedAt,
          generated_by: callerId,
          integrity_hash_sha256: integrityHash,
          counts: {
            audit_log: auditLog.length,
            auth_audit_log: authAuditLog.length,
            system_events: systemEvents.length,
            activities: activities.length,
            opportunities: opportunities.length,
            total: totalRecords
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[export-forensic-user-logs] Error:', error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
