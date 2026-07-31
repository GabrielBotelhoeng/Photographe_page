# Ricardo Dhener — Fotografia

Landing page cinematográfica com rolagem controlada por canvas, GSAP ScrollTrigger e Lenis.
HTML/CSS/JS puros — sem build, sem dependência de framework.

---

## Rodar

Precisa de um servidor local (o `fetch` do manifest de frames não funciona em `file://`):

```bash
# qualquer um destes serve
python -m http.server 5178
npx serve -l 5178
```

Depois abra <http://localhost:5178>.

---

## O que trocar antes de publicar

### 1. WhatsApp — `js/config.js`

```js
whatsapp: '5500000000000',   // <<< só dígitos: 55 + DDD + número
```

Enquanto estiver com zeros, o console avisa e os botões não levam a lugar nenhum.
Todos os links de WhatsApp do site (nav, CTA e rodapé) saem daí.

### 2. Depoimentos — `index.html`, seção `#depoimentos`

Marcada com `data-placeholder="depoimentos-de-exemplo"`. **São textos inventados.**
Substitua por depoimentos reais antes de publicar.

### 3. Textos sobre o Ricardo — `index.html`, seção `#sobre`

Escritos como rascunho, para dar tom. Reescreva com as palavras dele.

### 4. Fotos por categoria — `index.html`, seção `#servicos`

O atributo `data-img` de cada linha define a imagem que aparece no hover.
Hoje reaproveita fotos de casamento porque não há material de formatura e
aniversário adolescente. Trocar quando existir.

---

## Estrutura

```
index.html               marcação e todo o conteúdo em texto
css/style.css            design system + seções (comentado por bloco)
js/config.js             configuração editável
js/camera-sequence.js    a câmera do hero desenhada em canvas
js/main.js               Lenis, ScrollTrigger, menu, parallax, galerias
assets/img/              fotos tratadas (JPG + WebP)
assets/frames/           sequência de frames do hero (120 WebP + manifest.json)
```

---

## O hero

O hero é um `<canvas>` fixado na tela e "raspado" pela rolagem.

### Dois modos

`js/config.js` → `heroMode`. Com `auto` (o padrão) o site tenta os frames e cai
no procedural se não encontrar o manifest. **Hoje os frames existem, então é o
modo `frames` que está no ar.**

- **`frames`** (o que está rodando) — desenha a sequência de
  `assets/frames/`, descrita por `manifest.json`:

  ```json
  { "dir": "assets/frames/", "pattern": "frame_%04d.webp", "count": 120 }
  ```

  | progresso | o que acontece |
  |-----------|----------------|
  | 0.00–0.34 | aproximação: a câmera inteira, travelling lento para a frente |
  | 0.34–0.64 | a lente cresce e toma o quadro |
  | 0.64–0.86 | diafragma: o interior da óptica, a luz crescendo no centro |
  | 0.86–1.00 | travessia: **o canvas se dissolve** e a fotografia assume |

  Os frames são opacos — não dá para furar o diafragma como no procedural. Por
  isso a travessia é feita por opacidade: o canvas some no trecho final e
  `#heroReveal`, que vive atrás dele, fica visível. A constante que governa isso
  é `FRAMES_DISSOLVE` em `js/camera-sequence.js`.

- **`procedural`** — a câmera é desenhada vetorialmente. Funciona em qualquer
  lugar, pesa alguns KB, redimensiona sozinha. É o plano B se os frames sumirem.

  | progresso | o que acontece |
  |-----------|----------------|
  | 0.00–0.16 | câmera montada, rotação lenta |
  | 0.16–0.50 | vista explodida: as peças se separam num eixo diagonal, com chamadas técnicas |
  | 0.50–0.66 | remontagem |
  | 0.62–0.88 | o diafragma abre |
  | 0.84–1.00 | a câmera virtual atravessa a lente e revela a primeira fotografia |

  Aqui a abertura do diafragma é um **furo real no canvas**
  (`destination-out`), então a fotografia atrás aparece através dela.

### De onde vieram os frames

São **gerados por IA**, não filmados. Vale saber disso antes de falar deles como
material do Ricardo:

1. quadro inicial da câmera — Nano Banana Pro (Higgsfield), depois uma segunda
   passada para apagar as marcas de fabricante que o modelo tinha inventado;
2. movimento — Kling v3.0 image-to-video, 5 s, silencioso, um travelling
   contínuo (o movimento precisa ser monotônico, senão o scrub engasga);
3. extração — 120 dos 121 frames do vídeo, reduzidos para 1280 px de largura e
   salvos em WebP q72.

O `.mp4` de origem não está versionado.

**Se for regerar o plano, leia isto antes:** o prompt não pode mencionar texto,
marca ou logotipo — nem para proibir. Duas tentativas pediram explicitamente
"sem letras, sem nameplate, sem gravação" e nas duas o modelo respondeu gravando
inscrições inventadas no prisma, cada vez mais legíveis. O plano que está no ar
simplesmente **não fala do assunto**: diz apenas que as superfícies do corpo
continuam como estão no quadro de referência. Esse saiu limpo.

**Uma ressalva:** os 120 frames pesam **2,2 MB** no total, e `loadFrames()`
espera todos antes de trocar de modo (até lá o procedural segura a cena, então
nada quebra). Para aliviar, o caminho é baixar a contagem ou a qualidade.

---

## Acessibilidade

`prefers-reduced-motion: reduce` desliga smooth scroll, parallax e a sequência do
hero, e entrega o conteúdo estático e legível. Testado.

Nesse modo o hero para num quadro só. No procedural é o 0.9, com o diafragma
aberto e a foto aparecendo pelo furo; nos frames o quadro é o último, onde o
canvas já se dissolveu — senão o hero congelaria num close opaco da lente em vez
de entregar a fotografia.

---

## Uma armadilha que já custou caro aqui

Toda imagem do site vem embrulhada em `<picture>` (por causa do WebP). O
`<picture>` é uma caixa a mais entre o contêiner e a `<img>` — e, sem altura
própria, ele não repassa o `height:100%`. A imagem então cai na proporção
intrínseca, o `object-fit:cover` **nunca entra em ação** e o arquivo transborda o
contêiner em silêncio: nada quebra, só fica com o enquadramento errado.

Era isso que fazia a foto do fim do hero aparecer cortada. A correção está no
topo de `css/style.css`. Se criar um novo contêiner com `img{height:100%}`,
inclua o `picture` na regra.

---

## Notas de conteúdo

As fotografias em `assets/img/` são trabalhos reais do Ricardo, recortadas dos
perfis [@ricardodhener](https://www.instagram.com/ricardodhener/) e
[@dhener.eventos](https://www.instagram.com/dhener.eventos/). São arquivos de
resolução baixa (~700 px), suficientes para rascunho — **trocar pelos originais
em alta antes de publicar.**

A foto revelada no fim do hero é `igreja-nave.jpg`. Ela ocupa a tela inteira, e a
escolha não é estética por acaso: sendo quase quadrada e simétrica, aguenta tanto
o corte horizontal do desktop quanto o vertical do celular. Trocar por um retrato
volta a quebrar o enquadramento. O ponto de foco é ajustável por
`object-position` em `.hero__reveal img` (hoje `center 46%`, que mantém o arco
inteiro emoldurando o casal).
