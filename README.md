# 🥘 The Ingredient Web  
**An interactive hierarchical edge bundling visualization that explores the relationships between ingredients used in recipes.**

**License:** MIT  
**Python 3.9+**  
**D3.js 7.8+**

---

## 📌 Table of Contents  
- 🚀 [Project Overview](#project-overview)  
- 🛠️ [Used Technologies](#used-technologies)  
- ⚡ [Deployment](#deployment)  
- 🗺️ [Roadmap](#roadmap)   
- 👥 [Authors](#authors)  
- 📜 [License](#license)  

---

## 🚀 Project Overview  
**The Ingredient Web** is a data visualization tool that uncovers hidden ingredient relationships in cooking recipes. Using **hierarchical edge bundling**, it turns co-occurrence data into an interactive web of flavor connections.

### 🔑 Key Features

| Feature | Description |
|--------|-------------|
| Ingredient Graph | Nodes are ingredients, edges represent co-usage across recipes. |
| Hierarchical Bundling | Reduces visual clutter while highlighting clusters. |
| JSON-Based Data | All ingredient data parsed from real recipe datasets. |
| Target Audience | Food scientists, chefs, data enthusiasts, and curious cooks. |

**Data Source:** Parsed from cleaned recipe datasets (`clean_recipes_with_ingredients.json`)

---

## 🛠️ Used Technologies

### 🗃️ Backend & Data

| Technology | Role |
|-----------|------|
| Python | App logic, data parsing |
| Jupyter (IPython) | Preprocessing and exploration |
| JSON | Lightweight storage of ingredient networks |

### 🎨 Frontend & Visualization

| Technology | Role |
|-----------|------|
| D3.js | Hierarchical edge bundling and interactivity |
| HTML/CSS/JS | Base for frontend display (if included) |

---

## ⚡ Deployment

### 🔧 Quick Start with Docker

1. Clone the repo:

```
git clone https://github.com/your-username/The-Ingredient-Web.git
cd The-Ingredient-Web
```

2. Launch using Docker Compose:

```
docker-compose up --build
```

4. Access the app at: [http://localhost:8080](http://localhost:8080)

---

## 🗺️ Roadmap

| Phase | Status | Tasks |
|-------|--------|-------|
| Data Collection | ✅ | Parse and clean recipe ingredient data |
| Visualization | ✅ | Implement edge bundling with D3.js |
| UI Polish | 🟡 | Improve styling and filtering |
| Interactivity | 🟠 | Tooltips, zoom, and ingredient search |

---

## 👥 Authors

Azalia Alisheva a.alisheva@innopolis.university

Aisylu Fattakhova a.fattakhova@innopolis.university

---

## 📜 License

This project is licensed under the MIT License — see `LICENSE` for details.

---

🍽️ *Uncover the hidden harmony of your favorite ingredients with The Ingredient Web.*
