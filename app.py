from flask import Flask, jsonify, send_from_directory
import json
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

# --- Keep your load_heb_data function ---
def load_heb_data():
    """Helper function to load and cache HEB data"""
    # Consider caching this in a real application if the file is large/read often
    try:
        with open('data/heb_data.json', 'r', encoding='utf-8') as f: # Added encoding
            return json.load(f)
    except FileNotFoundError:
        # Make sure the CWD is where you think it is when running Flask
        print(f"Current Working Directory: {os.getcwd()}")
        raise Exception("HEB data file not found at 'data/heb_data.json'")
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid JSON format in heb_data.json: {e}")
    except Exception as e: # Catch other potential errors like permissions
        raise Exception(f"Error reading heb_data.json: {e}")


@app.route('/')
def home():
    """Serve the main HTML page"""
    # Ensure index.html exists
    if not os.path.exists(os.path.join(app.template_folder, 'index.html')):
         return "Error: templates/index.html not found.", 500
    return send_from_directory(app.template_folder, 'index.html')

# --- NEW ROUTE TO PROVIDE THE LIST OF CUISINES ---
@app.route('/api/cuisines')
def get_cuisines():
    """Endpoint to get the list of all available cuisines"""
    try:
        data = load_heb_data()
        
        # Assuming top-level children in hierarchy represent cuisines
        if "hierarchy" not in data or "children" not in data["hierarchy"]:
             return jsonify({"error": "Invalid data structure: Missing 'hierarchy' or 'children'"}), 500

        cuisine_names = [c["name"] for c in data["hierarchy"]["children"] if "name" in c]
        
        # Optional: Sort the list alphabetically
        cuisine_names.sort()
        
        return jsonify(cuisine_names)

    except Exception as e:
        # Log the error for debugging on the server
        print(f"Error in /api/cuisines: {e}")
        return jsonify({"error": f"Failed to load cuisine list: {e}"}), 500

# --- Keep your existing route for specific cuisine data ---
@app.route('/api/heb/<cuisine>')
def get_heb(cuisine):
    """Generic endpoint for specific cuisine HEB data"""
    try:
        data = load_heb_data()

        if "hierarchy" not in data or "children" not in data["hierarchy"]:
             return jsonify({"error": "Invalid data structure: Missing 'hierarchy' or 'children'"}), 500
        if "links" not in data:
             return jsonify({"error": "Invalid data structure: Missing 'links'"}), 500

        # Find the requested cuisine (case-insensitive comparison)
        cuisine_node = next(
            (c for c in data["hierarchy"]["children"] if "name" in c and c["name"].lower() == cuisine.lower()),
            None
        )

        if not cuisine_node:
            available = sorted([c["name"] for c in data["hierarchy"]["children"] if "name" in c])
            return jsonify({
                "error": f"Cuisine '{cuisine}' not found",
                "available_cuisines": available # Provide list for debugging
            }), 404

        # Filter links for the specific cuisine (case-insensitive comparison)
        # Make sure your links data actually has a 'cuisine' field!
        cuisine_links = [
            l for l in data["links"]
            if "cuisine" in l and l["cuisine"].lower() == cuisine.lower()
        ]
        
        # Check if the link structure is as expected
        # if data["links"] and "cuisine" not in data["links"][0]:
        #    print("Warning: Links in heb_data.json do not seem to have a 'cuisine' field.")
            # Decide how to handle this - maybe all links belong to all cuisines? Or filtering is impossible?
            # For now, we return only links matching the 'cuisine' field if it exists.


        return jsonify({
            # Return only the relevant part of the hierarchy for the specific cuisine
            "hierarchy": cuisine_node,
            "links": cuisine_links
        })

    except Exception as e:
        print(f"Error in /api/heb/{cuisine}: {e}") # Log error server-side
        # Be careful about sending raw exception messages to the client in production
        return jsonify({"error": f"An internal error occurred: {e}"}), 500

# --- Keep your main execution block ---
if __name__ == '__main__':
    # Verify paths before starting
    required_folders = ['templates', 'static', 'data']
    for folder in required_folders:
        if not os.path.exists(folder):
            print(f"Warning: Folder '{folder}' not found. Creating...")
            try:
                os.makedirs(folder)
                print(f"Created missing folder: {folder}")
            except OSError as e:
                 print(f"Error creating folder {folder}: {e}")
                 # Decide if you want to exit here

    # Check for specific required files
    if not os.path.exists('templates/index.html'):
        print("CRITICAL ERROR: 'templates/index.html' not found. Cannot serve frontend.")
        # exit(1) # Optional: stop the server if essential files are missing

    if not os.path.exists('data/heb_data.json'):
         print("CRITICAL ERROR: 'data/heb_data.json' not found. API endpoints will fail.")
         # exit(1) # Optional: stop the server if essential files are missing
    else:
         print(f"Data file found: {os.path.exists('data/heb_data.json')}")


    print(f"Templates folder: {app.template_folder}")
    print(f"Static folder: {app.static_folder}")
    print("Starting Flask server...")
    # Use host='0.0.0.0' to make it accessible from other devices on the network
    app.run(debug=True, port=5000, host='0.0.0.0')