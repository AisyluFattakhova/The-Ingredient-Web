# 🥘 The Ingredient Web: Mapping Culinary Pairings
## An interactive hierarchical edge bundling visualization that explores the relationships between ingredients used in recipes
---

## 📌 Table of Contents  
- 🚀 [Project Overview](#-project-overview)  
- 🛠️ [Used Technologies](#%EF%B8%8F-used-technologies)  
- 🔍 [Data Collection](#-data-collection) 
- ⚡ [Deployment](#-deployment)  
- 🗺️ [Roadmap](#%EF%B8%8F-roadmap)   
- 👥 [Authors](#-authors)  
- 📜 [License](#-license)  

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
| Python | App logic and data scraping |
| BeautifulSoup | Web scraping |
| Pandas | Data processing and transformation |
| Matplotlib | Ingredient pair frequency visualization |
| Flask (RESTful) | API for serving data to frontend |

---

### 🎨 Frontend & Visualization

| Technology | Role |
|-----------|------|
| D3.js | Hierarchical edge bundling and graph visualization |
| HTML/CSS/JavaScript | UI layout and interactivity |


---

## 🔍 Data Collection

- **Source**: [AllRecipes.com](https://www.allrecipes.com)
- **Method**: Web scraping using `BeautifulSoup`
- **Collected Data**:
  - Ingredient lists
  - Cuisine type classification

---

## ⚡ Deployment

### 🔧 Quick Start with Docker

1. Clone the repo:

```
git clone https://github.com/Data-Wrangling-and-Visualisation/The-Ingredient-Web.git
cd The-Ingredient-Web
```

2. Launch using Docker Compose:

```
docker-compose up --build
```

4. Access the app at: [http://localhost:5000](http://172.18.0.2:5000/)

---

## 🗺️ Roadmap

| Phase | Status | Tasks |
|-------|--------|-------|
Data Collection | ✅ | Scrape and clean recipe ingredient data
Visualization | ✅ | Implement edge bundling and charts
UI Polish | 🟡 | Add filters, search, and responsive design
Interactivity | 🟠 | Improve user engagement and highlight features

---

## 👥 Authors

Azalia Alisheva a.alisheva@innopolis.university

Aisylu Fattakhova a.fattakhova@innopolis.university

---

## 📜 License

This project is licensed under the MIT License — see `LICENSE` for details.

---

🍽️ *Uncover the hidden harmony of your favorite ingredients with The Ingredient Web.*
