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
assets/frames/           (vazio) sequência de frames do hero — ver abaixo
```

---

## O hero

O hero é um `<canvas>` fixado na tela e "raspado" pela rolagem. O roteiro:

| progresso | o que acontece |
|-----------|----------------|
| 0.00–0.16 | câmera montada, rotação lenta |
| 0.16–0.50 | vista explodida: as peças se separam num eixo diagonal, com chamadas técnicas |
| 0.50–0.66 | remontagem |
| 0.62–0.88 | o diafragma abre |
| 0.84–1.00 | a câmera virtual atravessa a lente e revela a primeira fotografia |

A abertura do diafragma é um **furo real no canvas** (`destination-out`), então a
fotografia que está atrás em HTML aparece através dela.

### Dois modos

`js/config.js` → `heroMode`:

- **`procedural`** (o que está rodando) — a câmera é desenhada vetorialmente.
  Funciona em qualquer lugar, pesa alguns KB, redimensiona sozinha.
- **`frames`** — desenha uma sequência de imagens. Para usar, coloque os frames
  em `assets/frames/` com um manifest:

```json
{ "dir": "assets/frames/", "pattern": "frame_%04d.webp", "count": 180 }
```

Com `heroMode: 'auto'` (o padrão) o site tenta os frames e cai no procedural se
não encontrar o manifest.

---

## Acessibilidade

`prefers-reduced-motion: reduce` desliga smooth scroll, parallax e a sequência do
hero, e entrega o conteúdo estático e legível. Testado.

---

## Notas de conteúdo

As fotografias em `assets/img/` são trabalhos reais do Ricardo, recortadas dos
perfis [@ricardodhener](https://www.instagram.com/ricardodhener/) e
[@dhener.eventos](https://www.instagram.com/dhener.eventos/). São arquivos de
resolução baixa (~700 px), suficientes para rascunho — **trocar pelos originais
em alta antes de publicar.**
