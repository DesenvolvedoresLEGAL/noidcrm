import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
          <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
          <p className="text-muted-foreground mb-8">
            Última atualização: 3 de janeiro de 2026
          </p>

          <div className="bg-muted/30 border border-border rounded-lg p-4 mb-8">
            <p className="text-sm mb-0">
              <strong>HUMANOID PLATFORMS LTDA</strong><br />
              CNPJ: 54.753.156/0001-72<br />
              E-mail: <a href="mailto:fala@humanoid-os.ai" className="text-primary">fala@humanoid-os.ai</a>
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar o NOID CRM ("Serviço"), plataforma desenvolvida e operada pela HUMANOID PLATFORMS LTDA ("Empresa", "nós" ou "nossos"), você ("Usuário", "você" ou "seu") concorda em cumprir e estar vinculado a estes Termos de Uso.
            </p>
            <p>
              Se você não concorda com estes termos, não utilize o Serviço. O uso continuado do Serviço após quaisquer alterações constitui aceitação dessas alterações.
            </p>
            <p>
              Você declara ter pelo menos 18 (dezoito) anos de idade ou, se menor, estar devidamente representado por responsável legal.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Definições</h2>
            <ul>
              <li><strong>Serviço:</strong> A plataforma NOID CRM, incluindo todas as suas funcionalidades, APIs, aplicativos e serviços relacionados.</li>
              <li><strong>Conta:</strong> O registro de acesso individual criado pelo Usuário para utilizar o Serviço.</li>
              <li><strong>Organização:</strong> A entidade empresarial à qual o Usuário está vinculado dentro do Serviço.</li>
              <li><strong>Dados do Cliente:</strong> Todas as informações, dados e conteúdos inseridos pelo Usuário no Serviço.</li>
              <li><strong>Usuário:</strong> Qualquer pessoa física ou jurídica que acesse ou utilize o Serviço.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Descrição do Serviço</h2>
            <p>
              O NOID CRM é um Sistema de Gestão de Relacionamento com Clientes (CRM) potencializado por Inteligência Artificial, projetado para automatizar e otimizar processos comerciais. O Serviço inclui, mas não se limita a:
            </p>
            <ul>
              <li>Gestão de oportunidades de vendas e pipeline comercial</li>
              <li>Criação e gerenciamento de propostas comerciais</li>
              <li>Automação de atividades e follow-ups</li>
              <li>Análise preditiva com inteligência artificial</li>
              <li>Relatórios e dashboards de performance</li>
              <li>Integração com serviços de terceiros</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Cadastro e Conta</h2>
            <p>
              Para utilizar o Serviço, você deve criar uma Conta fornecendo informações verdadeiras, precisas, atuais e completas. Você é responsável por:
            </p>
            <ul>
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Todas as atividades realizadas em sua Conta</li>
              <li>Notificar imediatamente a Empresa sobre qualquer uso não autorizado</li>
              <li>Manter seus dados cadastrais atualizados</li>
            </ul>
            <p>
              A Empresa reserva-se o direito de suspender ou encerrar Contas que contenham informações falsas ou que violem estes Termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Uso Aceitável</h2>
            <p>Você concorda em utilizar o Serviço apenas para fins lícitos e de acordo com estes Termos. É expressamente proibido:</p>
            <ul>
              <li>Utilizar o Serviço para enviar spam, conteúdo não solicitado ou comunicações em massa não autorizadas</li>
              <li>Armazenar, transmitir ou processar dados ilegais, difamatórios, obscenos ou que violem direitos de terceiros</li>
              <li>Tentar acessar áreas restritas do sistema ou de outros usuários sem autorização</li>
              <li>Realizar engenharia reversa, descompilar ou desmontar qualquer parte do Serviço</li>
              <li>Utilizar scripts, bots ou métodos automatizados não autorizados para acessar o Serviço</li>
              <li>Interferir ou tentar interferir na integridade ou performance do Serviço</li>
              <li>Revender, sublicenciar ou redistribuir o Serviço sem autorização expressa</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Planos e Pagamentos</h2>
            <p>
              O Serviço oferece diferentes planos de assinatura, incluindo opções gratuitas com funcionalidades limitadas e planos pagos com recursos avançados. Os termos específicos de cada plano são detalhados em nossa página de preços.
            </p>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 my-4">
              <p className="font-semibold text-amber-700 dark:text-amber-400 mb-2">⚠️ Modelo Pré-Pago</p>
              <p className="text-sm">
                <strong>O NOID CRM opera no modelo pré-pago (pague e use).</strong> O pagamento da mensalidade deve ser realizado até a data de vencimento acordada. 
                Caso o pagamento não seja identificado até a data de vencimento, o acesso de todos os usuários da organização será <strong>bloqueado no dia seguinte</strong>, 
                sendo restaurado imediatamente após a confirmação do pagamento.
              </p>
            </div>

            <ul>
              <li><strong>Modalidade pré-paga:</strong> Os planos funcionam no modelo "pague e use". O pagamento deve ser realizado antes ou até a data de vencimento para manter o acesso ao Serviço.</li>
              <li><strong>Bloqueio por inadimplência:</strong> Em caso de não pagamento até a data de vencimento, o acesso ao Serviço será suspenso no dia seguinte. O desbloqueio ocorre imediatamente após a confirmação do pagamento.</li>
              <li><strong>Renovação:</strong> Os planos são renovados mensalmente. O valor é calculado com base no número de usuários ativos multiplicado pelo valor por usuário do plano contratado.</li>
              <li><strong>Alterações de preço:</strong> Reservamo-nos o direito de alterar preços mediante aviso prévio de 30 (trinta) dias.</li>
              <li><strong>Reembolso:</strong> Solicitações de reembolso serão avaliadas caso a caso, conforme nossa política de reembolso.</li>
              <li><strong>Impostos:</strong> Os preços não incluem tributos, que serão adicionados conforme legislação aplicável.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo, design, código-fonte, marcas, logotipos e demais elementos do Serviço são de propriedade exclusiva da HUMANOID PLATFORMS LTDA ou de seus licenciadores, protegidos pelas leis de propriedade intelectual brasileiras e internacionais.
            </p>
            <p>
              Você mantém todos os direitos sobre os Dados do Cliente inseridos no Serviço. Ao utilizar o Serviço, você nos concede uma licença limitada para processar esses dados conforme necessário para a prestação do Serviço.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Privacidade e Proteção de Dados</h2>
            <p>
              O tratamento de seus dados pessoais é regido por nossa <a href="/privacy" className="text-primary hover:underline">Política de Privacidade</a>, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD).
            </p>
            <p>
              Ao utilizar o Serviço, você reconhece e concorda que a Empresa atua como Operadora de dados pessoais em relação aos Dados do Cliente, sendo você o Controlador desses dados perante seus próprios clientes e contatos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">9. Limitação de Responsabilidade</h2>
            <p>
              O Serviço é fornecido "como está" e "conforme disponível". A Empresa não garante que o Serviço será ininterrupto, livre de erros ou completamente seguro.
            </p>
            <p>
              Na máxima extensão permitida por lei, a HUMANOID PLATFORMS LTDA não será responsável por:
            </p>
            <ul>
              <li>Danos indiretos, incidentais, especiais, consequenciais ou punitivos</li>
              <li>Perda de lucros, dados, uso, fundo de comércio ou outras perdas intangíveis</li>
              <li>Interrupções causadas por fatores fora de nosso controle razoável</li>
            </ul>
            <p>
              Em qualquer caso, nossa responsabilidade total não excederá o valor pago pelo Usuário nos 12 (doze) meses anteriores ao evento que deu origem à reclamação.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">10. Rescisão</h2>
            <p>
              Você pode encerrar sua Conta a qualquer momento através das configurações do Serviço ou entrando em contato conosco.
            </p>
            <p>
              A Empresa pode suspender ou encerrar seu acesso ao Serviço, com ou sem aviso prévio, por violação destes Termos ou por qualquer outro motivo a nosso exclusivo critério.
            </p>
            <p>
              Após o encerramento, seus Dados do Cliente permanecerão disponíveis para exportação por 30 (trinta) dias, após os quais poderão ser permanentemente excluídos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">11. Disposições Gerais</h2>
            <ul>
              <li><strong>Lei Aplicável:</strong> Estes Termos são regidos pelas leis da República Federativa do Brasil.</li>
              <li><strong>Foro:</strong> Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes destes Termos.</li>
              <li><strong>Acordo Integral:</strong> Estes Termos constituem o acordo integral entre você e a Empresa em relação ao Serviço.</li>
              <li><strong>Cessão:</strong> Você não pode ceder ou transferir estes Termos sem nosso consentimento prévio por escrito.</li>
              <li><strong>Renúncia:</strong> A falha em exercer qualquer direito previsto nestes Termos não constituirá renúncia a tal direito.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">12. Contato</h2>
            <p>
              Para dúvidas, sugestões ou reclamações relacionadas a estes Termos, entre em contato conosco:
            </p>
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <p className="mb-0">
                <strong>HUMANOID PLATFORMS LTDA</strong><br />
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
