# 🥘 The Ingredient Web: Mapping Culinary Pairings
## An interactive hierarchical edge bundling visualization that explores the relationships between ingredients used in recipes
---

## 📌 Table of Contents  
- 🚀 [Project Overview](#-project-overview)  
- 🛠️ [Used Technologies](#%EF%B8%8F-used-technologies)  
- 🔍 [Data Collection](#-data-collection)
- 📊 [Exploratory Data Analysis](#-exploratory-data-analysis) 
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

## 📊 Exploratory Data Analysis

![output](https://github.com/user-attachments/assets/9d8c16fe-7986-477b-b9d3-9f9109b3f210)

![image](https://github.com/user-attachments/assets/97e8b684-1bc7-48f1-bfc1-27955c3d8827)
![image](https://github.com/user-attachments/assets/0eab79cd-e29e-4130-ac61-5e80f8504dde)
Top 20 Most Common Ingredients Overall:
- ingredients
- salt               1295
- sugar              1157
- water               839
- garlic              763
- onion               730
- butter              691
- egg                 630
- flour               618
- oil                 581
- pepper              503
- olive oil           440
- milk                331
- tomato              254
- vanilla extract     230
- cinnamon            207
- cayenne pepper      206
- soy sauce           205
- cumin               194
- baking powder       183
- lemon juice         176
![image](https://github.com/user-attachments/assets/449c6cb2-5146-4c94-9b9c-fb4c4bd4d402)
#### Ingredient Co-occurrence Analysis
![image](https://github.com/user-attachments/assets/e3019d30-aeec-4987-b6bd-6641dcfb4d0d)

### EDA Summary 
- The dataset contains 2331 recipes across 49 cuisines.
- Cuisine distribution is uneven, with 'Canadian' being the most frequent (67 recipes) and 'Belgian' the least (6 recipes).
- Recipes typically contain between 7 and 13 ingredients (IQR), with a median of 10.
- The most common ingredients overall are: salt, sugar, water, garlic, onion.
- Co-occurrence heatmap highlights common ingredient pairings across all recipes (e.g., salt & pepper, flour & sugar).
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

### Website
The project is deployed on Render: [link](https://the-ingredient-web-k6lv.onrender.com/)

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
