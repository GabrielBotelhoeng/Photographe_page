# Bibliotecas de terceiros

Baixadas para dentro do projeto de propósito. Servidas por CDN, uma indisponibilidade
da jsdelivr derrubaria de uma vez o hero, a rolagem suave e o menu — o site inteiro
vira uma página morta. Aqui dentro, o pior caso é a CDN sumir e nada acontecer.

| arquivo | versão | origem |
|---------|--------|--------|
| `gsap.min.js` | 3.12.5 | `https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js` |
| `ScrollTrigger.min.js` | 3.12.5 | `https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js` |
| `lenis.min.js` | 1.1.18 | `https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.min.js` |

GSAP e ScrollTrigger **precisam ser da mesma versão** — o plugin acessa interfaces
internas do core e a combinação errada falha de formas estranhas, não com um erro
limpo.

Para atualizar: baixe os três das URLs acima trocando a versão, rode o site e
confira o hero ponta a ponta (a rolagem do hero é o que mais depende dessa dupla).

As fontes seguem a mesma lógica e estão em `assets/fonts/`, com o CSS gerado em
`css/fonts.css`.
