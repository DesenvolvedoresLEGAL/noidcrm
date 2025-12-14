import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="w-full p-4 md:p-6 border-b border-border/40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">NOID CRM</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
          <p className="text-muted-foreground mb-8">
            Última atualização: 14 de dezembro de 2024
          </p>

          <div className="bg-muted/30 border border-border rounded-lg p-4 mb-8">
            <p className="text-sm mb-0">
              <strong>HUMANOID PLATFORMS LTDA</strong><br />
              CNPJ: 54.753.156/0001-72<br />
              E-mail: <a href="mailto:fala@humanoid-os.ai" className="text-primary">fala@humanoid-os.ai</a>
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Introdução</h2>
            <p>
              A HUMANOID PLATFORMS LTDA ("Empresa", "nós" ou "nossos") está comprometida com a proteção da privacidade e dos dados pessoais de nossos usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações ao utilizar o NOID CRM ("Serviço").
            </p>
            <p>
              Esta política está em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD) e demais normas aplicáveis à proteção de dados pessoais no Brasil.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Dados Coletados</h2>
            <p>Coletamos diferentes tipos de informações para fornecer e melhorar nosso Serviço:</p>
            
            <h3 className="text-lg font-medium mt-4 mb-2">2.1. Dados fornecidos por você</h3>
            <ul>
              <li><strong>Dados de cadastro:</strong> Nome, e-mail, telefone, cargo, nome da empresa</li>
              <li><strong>Dados de perfil:</strong> Foto de perfil, preferências de configuração</li>
              <li><strong>Dados comerciais:</strong> Informações sobre clientes, oportunidades, propostas e atividades inseridas no CRM</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2. Dados coletados automaticamente</h3>
            <ul>
              <li><strong>Dados de uso:</strong> Páginas visitadas, funcionalidades utilizadas, horários de acesso</li>
              <li><strong>Dados técnicos:</strong> Endereço IP, tipo de navegador, sistema operacional, identificadores de dispositivo</li>
              <li><strong>Logs de atividade:</strong> Registros de ações realizadas no sistema para fins de auditoria e segurança</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.3. Dados de terceiros</h3>
            <ul>
              <li>Informações obtidas através de integrações autorizadas (Google Calendar, Gmail, etc.)</li>
              <li>Dados de enriquecimento de leads (quando aplicável)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Finalidade do Tratamento</h2>
            <p>Utilizamos seus dados pessoais para as seguintes finalidades:</p>
            <ul>
              <li><strong>Prestação do Serviço:</strong> Operar e manter o CRM, processar suas solicitações e fornecer suporte</li>
              <li><strong>Personalização:</strong> Adaptar a experiência do usuário, incluindo sugestões baseadas em inteligência artificial</li>
              <li><strong>Comunicação:</strong> Enviar notificações, alertas e atualizações sobre o Serviço</li>
              <li><strong>Análise e melhorias:</strong> Entender como o Serviço é usado e desenvolver novas funcionalidades</li>
              <li><strong>Segurança:</strong> Detectar, prevenir e responder a fraudes, abusos ou atividades ilegais</li>
              <li><strong>Cumprimento legal:</strong> Atender obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Base Legal para Tratamento</h2>
            <p>O tratamento de dados pessoais realizado pela Empresa está fundamentado nas seguintes bases legais (Art. 7º da LGPD):</p>
            <ul>
              <li><strong>Execução de contrato:</strong> Para prestação do Serviço contratado</li>
              <li><strong>Consentimento:</strong> Para tratamentos específicos que requerem sua autorização expressa</li>
              <li><strong>Legítimo interesse:</strong> Para melhorias do Serviço e comunicações relevantes</li>
              <li><strong>Cumprimento de obrigação legal:</strong> Para atender exigências legais e regulatórias</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Compartilhamento de Dados</h2>
            <p>Podemos compartilhar seus dados pessoais nas seguintes situações:</p>
            <ul>
              <li><strong>Prestadores de serviço:</strong> Empresas que nos auxiliam na operação do Serviço (hospedagem, processamento de pagamentos, análise de dados)</li>
              <li><strong>Parceiros de integração:</strong> Serviços de terceiros que você opte por conectar ao CRM</li>
              <li><strong>Requisições legais:</strong> Quando exigido por lei, ordem judicial ou autoridade competente</li>
              <li><strong>Proteção de direitos:</strong> Para proteger nossos direitos, privacidade, segurança ou propriedade</li>
              <li><strong>Transações corporativas:</strong> Em caso de fusão, aquisição ou venda de ativos</li>
            </ul>
            <p>
              Não vendemos, alugamos ou comercializamos seus dados pessoais para terceiros para fins de marketing.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Transferência Internacional de Dados</h2>
            <p>
              Seus dados podem ser processados em servidores localizados fora do Brasil. Nestes casos, garantimos que a transferência ocorra para países com nível adequado de proteção ou mediante cláusulas contratuais padrão que assegurem a proteção de seus dados conforme a LGPD.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Retenção de Dados</h2>
            <p>
              Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta política, a menos que um período de retenção mais longo seja exigido ou permitido por lei.
            </p>
            <ul>
              <li><strong>Dados de conta:</strong> Mantidos enquanto sua conta estiver ativa</li>
              <li><strong>Dados comerciais:</strong> Retidos por até 5 anos após encerramento para fins fiscais e legais</li>
              <li><strong>Logs de segurança:</strong> Retidos por até 2 anos para fins de auditoria</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Direitos do Titular</h2>
            <p>
              Conforme a LGPD, você possui os seguintes direitos em relação aos seus dados pessoais:
            </p>
            <ul>
              <li><strong>Confirmação e acesso:</strong> Confirmar a existência de tratamento e acessar seus dados</li>
              <li><strong>Correção:</strong> Solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> Solicitar para dados desnecessários ou tratados em desconformidade</li>
              <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado para transferência</li>
              <li><strong>Eliminação:</strong> Solicitar a exclusão de dados tratados com base em consentimento</li>
              <li><strong>Informação sobre compartilhamento:</strong> Saber com quais entidades seus dados foram compartilhados</li>
              <li><strong>Revogação do consentimento:</strong> Revogar consentimento previamente fornecido</li>
              <li><strong>Oposição:</strong> Opor-se ao tratamento em determinadas situações</li>
            </ul>
            <p>
              Para exercer esses direitos, entre em contato conosco através do e-mail <a href="mailto:fala@humanoid-os.ai" className="text-primary">fala@humanoid-os.ai</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Segurança dos Dados</h2>
            <p>
              Implementamos medidas técnicas e organizacionais apropriadas para proteger seus dados pessoais contra acesso não autorizado, alteração, divulgação ou destruição, incluindo:
            </p>
            <ul>
              <li>Criptografia de dados em trânsito e em repouso</li>
              <li>Controles de acesso baseados em função</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Auditorias regulares de segurança</li>
              <li>Treinamento de funcionários em proteção de dados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Cookies e Tecnologias de Rastreamento</h2>
            <p>
              Utilizamos cookies e tecnologias similares para melhorar sua experiência, lembrar suas preferências e analisar o uso do Serviço. Você pode gerenciar suas preferências de cookies através das configurações do seu navegador.
            </p>
            <ul>
              <li><strong>Cookies essenciais:</strong> Necessários para o funcionamento do Serviço</li>
              <li><strong>Cookies de preferências:</strong> Lembram suas configurações e escolhas</li>
              <li><strong>Cookies analíticos:</strong> Ajudam a entender como o Serviço é utilizado</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Quando fizermos alterações significativas, notificaremos você por e-mail ou através de um aviso destacado no Serviço. Recomendamos revisar esta política regularmente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. Contato do Encarregado (DPO)</h2>
            <p>
              Para questões relacionadas à privacidade e proteção de dados, ou para exercer seus direitos como titular, entre em contato com nosso Encarregado de Proteção de Dados:
            </p>
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <p className="mb-0">
                <strong>HUMANOID PLATFORMS LTDA</strong><br />
                Encarregado de Proteção de Dados (DPO)<br />
                CNPJ: 54.753.156/0001-72<br />
                E-mail: <a href="mailto:fala@humanoid-os.ai" className="text-primary">fala@humanoid-os.ai</a>
              </p>
            </div>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} HUMANOID PLATFORMS LTDA. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
