/* ===========================================================================
   CONFIGURAÇÃO DO SITE
   ---------------------------------------------------------------------------
   >>> TROQUE OS VALORES ABAIXO. É o único arquivo que precisa ser editado
       para o site sair do ar de rascunho.
   =========================================================================== */

window.SITE = {

  /* -----------------------------------------------------------------------
     WhatsApp — só dígitos, com código do país (55) e DDD.
     Ex.: '5562999998888'
     ATENÇÃO: enquanto estiver com o valor abaixo, os botões de WhatsApp
     não levam a lugar nenhum de verdade.
     ----------------------------------------------------------------------- */
  whatsapp: '5500000000000',

  /* Mensagem que já vem digitada quando a pessoa abre a conversa */
  whatsappMsg: 'Olá, Ricardo! Vim pelo site e gostaria de um orçamento.',

  instagram: 'https://www.instagram.com/ricardodhener/',
  instagramEventos: 'https://www.instagram.com/dhener.eventos/',

  /* -----------------------------------------------------------------------
     Sequência da câmera no hero.
     'auto'       — usa os frames de assets/frames/ se existirem;
                    senão renderiza a câmera vetorial em canvas.
     'procedural' — força a câmera vetorial.
     'frames'     — força a sequência de frames.
     ----------------------------------------------------------------------- */
  heroMode: 'auto',
  framesManifest: 'assets/frames/manifest.json'
};
