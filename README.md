# Maison Form — immersive virtual clothing store

A single-page, scroll-driven 3D store concept. The visitor begins at the ground-floor threshold of a 30 × 23 metre store, browses folded apparel on category-labelled wall shelving, and can select a category to move in for a closer look. Scroll through the double-height atrium, U-shaped staircases with intermediate landings, elevator, and four audience floors. Floor buttons animate the camera up the stair route; product selections open an animated detail view. A shopping bag preview and AI stylist are included.

## Floors

- Ground: new arrivals, tees, shirts, jeans, trousers, jackets, and accessories
- First: men
- Second: women
- Third: children
- Fourth: grandparents

The scene is a browser-rendered Three.js experience. Catalog data lives in `data/products.json` for local use. The ground floor includes five garment styles; men’s, women’s, children’s, and grandparents’ floors include their apparel categories. Folded garments and hanging pieces are modeled in the scene. Product detail cards use illustrative demo imagery and listings, not verified inventory or final product photography.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the local address Vite prints (usually `http://127.0.0.1:5173`). The demo catalog works without external credentials.

## Gemini stylist and MongoDB catalog

Add credentials to `.env` on the server only:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
MONGODB_URI=your_mongodb_connection_string
MONGODB_DATABASE=maison_form
```

Then seed the demo catalog into MongoDB:

```powershell
npm run seed:catalog
```

The API reads active documents from the `products` collection and uses the demo JSON catalog if MongoDB is unset or unavailable. The Gemini key is never sent to the browser. The stylist only recommends IDs found in the supplied catalog; without a Gemini key, the client offers its local catalog guide. `GET /api/health` reports whether MongoDB and Gemini are configured.

## Production build

```powershell
npm run build
$env:NODE_ENV = "production"
npm start
```

The shopping bag is a front-end preview. This starter does not process payments, reserve stock, or create orders. Replace demo items and imagery with approved inventory and photography before launch.
