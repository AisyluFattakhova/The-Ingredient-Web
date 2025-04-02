from flask import Flask, jsonify, send_from_directory
import json
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

def load_heb_data():
    """Helper function to load and cache HEB data"""
    try:
        with open('data/heb_data.json') as f:
            return json.load(f)
    except FileNotFoundError:
        raise Exception("HEB data file not found at 'data/heb_data.json'")
    except json.JSONDecodeError:
        raise Exception("Invalid JSON format in heb_data.json")

@app.route('/')
def home():
    """Serve the main HTML page"""
    return send_from_directory('templates', 'index.html')

@app.route('/api/heb/<cuisine>')
def get_heb(cuisine):
    """Generic endpoint for any cuisine"""
    try:
        data = load_heb_data()
        
        # Find the requested cuisine
        cuisine_node = next(
            (c for c in data["hierarchy"]["children"] if c["name"].lower() == cuisine.lower()),
            None
        )

        if not cuisine_node:
            return jsonify({
                "error": f"Cuisine '{cuisine}' not found",
                "available_cuisines": [c["name"] for c in data["hierarchy"]["children"]]
            }), 404

        return jsonify({
            "hierarchy": {
                "name": cuisine_node["name"],
                "children": cuisine_node.get("children", [])
            },
            "links": [l for l in data["links"] if l["cuisine"].lower() == cuisine.lower()]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Verify paths before starting
    required_folders = ['templates', 'static', 'data']
    for folder in required_folders:
        if not os.path.exists(folder):
            os.makedirs(folder)
            print(f"Created missing folder: {folder}")

    print(f"Templates exists: {os.path.exists('templates/index.html')}")
    print(f"Data file exists: {os.path.exists('data/heb_data.json')}")
    
    app.run(debug=True, port=5000)