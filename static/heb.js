// Wait for the DOM to be fully loaded before running D3 code
document.addEventListener('DOMContentLoaded', () => {

  // --- Configuration ---
  const container = d3.select("#heb-container");
  const controls = d3.select("#controls"); // Select controls div for title updates
  const height = 1000;  // Fixed height
  const defaultRadiusMargin = 80; // Margin from edge
  const color = d3.scaleOrdinal(d3.schemeCategory10); // Color scale for nodes (maybe based on category later?)
  const lineColors = [ // Colors for links
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
      "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
      "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5"
  ];

  // --- State Variables ---
  let currentWidth = container.node().getBoundingClientRect().width;
  let radius = calculateRadius(currentWidth);
  let currentCuisineData = null; // To store data for resize re-render

  // --- SVG Setup (Create SVG and main group ONCE) ---
  const svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .style("background", "transparent");

  const g = svg.append("g"); // The main group for transformations

  // --- D3 Layout Helpers ---
  const line = d3.lineRadial()
    .curve(d3.curveBundle.beta(0.95)) // Adjust beta for curve tightness (0 is straight, 1 is very curvy)
    .radius(d => d.y)
    .angle(d => d.x * Math.PI / 180);

  // --- Core Functions ---

  function calculateRadius(width) {
      return Math.max(150, Math.min(width, height) / 2 - defaultRadiusMargin); // Ensure a minimum radius
  }

  function updateSvgTransform() {
      currentWidth = container.node().getBoundingClientRect().width;
      radius = calculateRadius(currentWidth); // Recalculate radius on resize
      svg.attr("width", currentWidth); // Update SVG width attribute if needed
      g.attr("transform", `translate(${currentWidth / 2},${height / 2})`);
  }

  // Initialize SVG transform
  updateSvgTransform();

  async function loadData(cuisineName) {
      if (!cuisineName) {
          clearVisualization("Select a cuisine from the list.");
          updateTitle("Ingredient Relationships");
          return;
      }

      setLoadingState(true, cuisineName); // Show loading state

      try {
          const response = await fetch(`/api/heb/${cuisineName}`);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status} for ${cuisineName}`);
          }
          const data = await response.json();

          if (!data || !data.hierarchy || !data.links) {
               throw new Error(`Incomplete data received for ${cuisineName}`);
          }

          currentCuisineData = data; // Store for potential resize re-render
          updateTitle(`Ingredient Relationships - ${cuisineName}`);
          renderVisualization(data);

      } catch (error) {
          console.error(`Error loading data for ${cuisineName}:`, error);
          displayErrorMessage(`Failed to load data for ${cuisineName}. Please try another cuisine or check the console.`);
          currentCuisineData = null; // Clear data on error
      } finally {
          setLoadingState(false); // Hide loading state
      }
  }

  function renderVisualization(data) {
      g.selectAll("*").remove(); // Clear previous visualization content from the group

      // --- Filtering ---
      // Filter 1: Remove weak links (value <= 2)
      const filteredLinks = data.links.filter(link => link.value > 2);
      if (filteredLinks.length === 0) {
          displayInfoMessage("No ingredient connections strong enough to display for this cuisine.");
          return;
      }

      // Calculate node degrees based on *filtered* links
      const nodeDegrees = {};
      const nodesInFilteredLinks = new Set();
      filteredLinks.forEach(link => {
          nodeDegrees[link.source] = (nodeDegrees[link.source] || 0) + 1;
          nodeDegrees[link.target] = (nodeDegrees[link.target] || 0) + 1;
          nodesInFilteredLinks.add(link.source);
          nodesInFilteredLinks.add(link.target);
      });

      // Filter 2: Remove nodes with degree <= 1 (only connected by one weak link or orphans)
      // We also need the original hierarchy to map names back
      const filteredHierarchy = filterHierarchy(data.hierarchy, node => nodeDegrees[node.name] > 1 && nodesInFilteredLinks.has(node.name));

      if (!filteredHierarchy || !filteredHierarchy.children || filteredHierarchy.children.length === 0) {
          displayInfoMessage("No significant ingredient clusters found after filtering.");
          return;
      }

      // Filter 3: Final link filter: only include links where BOTH source and target survived the node filter
      const finalLinks = filteredLinks.filter(link =>
          nodeDegrees[link.source] > 1 && nodeDegrees[link.target] > 1
      );

      if (finalLinks.length === 0) {
           displayInfoMessage("No connections remain after filtering ingredients.");
           return;
      }


      // --- D3 Hierarchy & Layout ---
      const root = d3.hierarchy(filteredHierarchy)
        .sum(d => d.value || 1) // Use value if present, otherwise count as 1
        .sort((a, b) => d3.ascending(a.data.name, b.data.name)); // Sort leaves alphabetically

      // Create cluster layout using the dynamic radius
      const cluster = d3.cluster().size([360, radius]);
      cluster(root);

      // Store leaf node positions efficiently
      const nodeMap = new Map();
      root.leaves().forEach(d => nodeMap.set(d.data.name, d));

      // Check if nodes needed for links exist in the map (debugging step)
      finalLinks.forEach(link => {
          if (!nodeMap.has(link.source)) console.warn(`Source node missing in map: ${link.source}`);
          if (!nodeMap.has(link.target)) console.warn(`Target node missing in map: ${link.target}`);
      });


      // --- Draw Links ---
      g.selectAll(".link")
        .data(finalLinks)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d => {
          const source = nodeMap.get(d.source);
          const target = nodeMap.get(d.target);
          // Ensure both nodes exist after filtering before drawing link
          if (source && target) {
            // Use control points for smoother bundling if needed, or just source/target for basic bundle
            // For HEB, d3.lineRadial expects an array of points [start, end] or [start, control1, ..., controlN, end]
            // For simple bundling, just source and target works with curveBundle
             return line([source, target]);
          }
          return null; // Don't draw if a node is missing
        })
        .style("stroke", (d, i) => lineColors[i % lineColors.length]) // Cycle through colors
        .style("fill", "none")
        .style("stroke-width", d => Math.min(8, Math.max(1, Math.sqrt(d.value)))) // Scale width, cap max size
        .style("stroke-opacity", 0.6); // Adjust opacity

      // --- Draw Nodes ---
      const nodes = g.selectAll(".node")
        .data(root.leaves()) // Only draw leaf nodes (ingredients)
        .enter().append("g")
        .attr("class", "node")
        // Position node group: Rotate, then translate along radius
        .attr("transform", d => `rotate(${d.x - 90}) translate(${d.y},0)`)
        .style("cursor", "pointer"); // Indicate interactivity


      // Append circles to node groups
      nodes.append("circle")
        .attr("r", 5) // Node radius
        .style("fill", d => color(d.parent.data.name)) // Color by parent category if desired, or fixed color
        .style("stroke", "#333")
        .style("stroke-width", 1);

      // Append text labels to node groups
      nodes.append("text")
        .attr("dy", "0.31em")
        // Position text based on angle: offset outwards, adjust anchor
        .attr("x", d => d.x < 180 ? 8 : -8) // Offset text from circle
        .style("text-anchor", d => d.x < 180 ? "start" : "end")
        // Rotate text label back so it's horizontal
        .attr("transform", d => d.x < 180 ? null : "rotate(180)")
        .style("font-size", "10px")
        .style("font-weight", "400")
        // .style("fill", "#333") // Text color
        .text(d => d.data.name);

      // --- Interactivity ---
      setupInteractivity();
  }

  // Recursive helper to filter the hierarchy based on a condition function
  function filterHierarchy(node, condition) {
      // If it's a leaf node, check the condition
      if (!node.children) {
          return condition(node) ? node : null;
      }

      // If it's an internal node, filter its children recursively
      const filteredChildren = node.children
          .map(child => filterHierarchy(child, condition))
          .filter(child => child !== null); // Remove null children

      // If the node has any surviving children, keep it, otherwise discard it
      if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
      } else {
           // Also check condition for internal nodes if they represent something meaningful (e.g., categories)
           // If internal nodes should always be kept if they have children, remove this check.
           // return condition(node) ? { ...node, children: [] } : null; // Decide if empty branches should be kept
           return null; // Prune branch if no leaves survived
      }
  }


  function setupInteractivity() {
      const links = g.selectAll(".link");
      const nodes = g.selectAll(".node"); // Select the group for easier targeting

      links
          .on("mouseover", function (event, d) {
              const sourceName = d.source;
              const targetName = d.target;

              // Dim all links and nodes initially
              links.style("stroke-opacity", 0.1);
              nodes.style("opacity", 0.2);

              // Highlight the hovered link
              d3.select(this)
                  .style("stroke-opacity", 0.9)
                  .style("stroke-width", dd => Math.min(10, Math.max(1.5, Math.sqrt(dd.value) * 1.5))) // Slightly thicker on hover
                  .raise(); // Bring to front

              // Highlight connected nodes
              nodes.filter(nodeData => nodeData.data.name === sourceName || nodeData.data.name === targetName)
                  .style("opacity", 1)
                  .select("circle")
                  .style("stroke-width", 2.5)
                  .style("stroke", "#000");

               nodes.filter(nodeData => nodeData.data.name === sourceName || nodeData.data.name === targetName)
                  .select("text")
                  .style("font-weight", "bold");
          })
          .on("mouseout", function (event, d) {
              // Restore default opacity and styles
              links
                .style("stroke-opacity", 0.6) // Restore original opacity
                .style("stroke-width", dd => Math.min(8, Math.max(1, Math.sqrt(dd.value)))); // Restore original width

              nodes
                .style("opacity", 1) // Restore original opacity
                .select("circle")
                .style("stroke-width", 1) // Restore original stroke width
                .style("stroke", "#333"); // Restore original stroke color

              nodes.select("text")
                  .style("font-weight", "400"); // Restore original font weight
          });

      // Optional: Add hover effect to nodes to highlight their links
      nodes
        .on("mouseover", function(event, d) {
            const nodeName = d.data.name;
            nodes.style("opacity", 0.2); // Dim all nodes
            links.style("stroke-opacity", 0.1); // Dim all links

            d3.select(this).style("opacity", 1); // Highlight hovered node
            d3.select(this).select("circle").style("stroke", "#000").style("stroke-width", 2.5);
            d3.select(this).select("text").style("font-weight", "bold");


            // Highlight connected links
            links.filter(linkData => linkData.source === nodeName || linkData.target === nodeName)
               .style("stroke-opacity", 0.9)
               .style("stroke-width", dd => Math.min(10, Math.max(1.5, Math.sqrt(dd.value) * 1.5)))
               .raise();

           // Highlight connected nodes
           const connectedNodeNames = new Set([nodeName]);
           links.filter(linkData => linkData.source === nodeName || linkData.target === nodeName)
                .each(linkData => {
                    connectedNodeNames.add(linkData.source);
                    connectedNodeNames.add(linkData.target);
                });

           nodes.filter(nodeData => connectedNodeNames.has(nodeData.data.name))
               .style("opacity", 1)
               .select("circle") // Ensure circle style is also applied if needed
               .style("stroke", "#000")
               .style("stroke-width", 1.5); // Highlight neighbours slightly less than hovered one
           nodes.filter(nodeData => connectedNodeNames.has(nodeData.data.name))
                .select("text")
                .style("font-weight", "500");

           // Ensure the primary hovered node remains boldest
            d3.select(this).select("text").style("font-weight", "bold");
            d3.select(this).select("circle").style("stroke-width", 2.5);

        })
        .on("mouseout", function(event, d) {
              // Restore default styles (same as link mouseout)
              links
                .style("stroke-opacity", 0.6)
                .style("stroke-width", dd => Math.min(8, Math.max(1, Math.sqrt(dd.value))));

              nodes
                .style("opacity", 1)
                .select("circle")
                .style("stroke-width", 1)
                .style("stroke", "#333");

              nodes.select("text")
                  .style("font-weight", "400");
        });
  }


  // --- UI Helper Functions ---
  function updateTitle(text) {
      controls.select("h1").text(text);
  }

  function setLoadingState(isLoading, cuisineName = '') {
      const loadingIndicator = container.select(".loading-indicator"); // Use a dedicated element

      if (isLoading) {
          updateTitle(`Loading ${cuisineName}...`);
          g.selectAll("*").remove(); // Clear current viz
          container.style("opacity", 0.5); // Dim container
          // Add a loading message/spinner if it doesn't exist
          if (loadingIndicator.empty()) {
              container.append("div")
                  .attr("class", "loading-indicator")
                  .style("position", "absolute")
                  .style("top", "50%")
                  .style("left", "50%")
                  .style("transform", "translate(-50%, -50%)")
                  .style("font-size", "1.5em")
                  .style("color", "#555")
                  .text("Loading...");
          }
          loadingIndicator.style("display", "block");

      } else {
           container.style("opacity", 1); // Restore container opacity
           if (!loadingIndicator.empty()) {
               loadingIndicator.style("display", "none"); // Hide indicator
           }
      }
  }

  function displayErrorMessage(message) {
      g.selectAll("*").remove(); // Clear drawing area
      g.append("text")
        .attr("class", "error-message")
        .attr("x", 0)
        .attr("y", 0) // Centered vertically due to group transform
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("fill", "red")
        .style("font-size", "14px")
        .text(message);
      updateTitle("Error"); // Update main title
  }

   function displayInfoMessage(message) {
      g.selectAll("*").remove(); // Clear drawing area
      g.append("text")
        .attr("class", "info-message")
        .attr("x", 0)
        .attr("y", 0) // Centered vertically due to group transform
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("fill", "#666")
        .style("font-size", "14px")
        .text(message);
      // Keep the title reflecting the selected cuisine
  }

   function clearVisualization(message = "") {
      g.selectAll("*").remove();
      currentCuisineData = null;
       if (message) {
           displayInfoMessage(message);
       }
  }

  // --- Event Listeners ---

  // Dropdown change listener
  const selectElement = document.getElementById("cuisine-select");
  if (selectElement) {
      selectElement.addEventListener("change", (e) => {
           loadData(e.target.value); // Pass the selected cuisine name
      });
  } else {
      console.error("Cuisine select dropdown not found.");
      displayErrorMessage("Could not find the cuisine selector.");
  }


  // Resize listener
  window.addEventListener("resize", () => {
      updateSvgTransform(); // Update size and centering
      // Re-render the visualization with the *current* data and new radius
      if (currentCuisineData) {
          renderVisualization(currentCuisineData);
      } else {
          // If no data is loaded (e.g., initial state or after error),
          // you might want to redraw placeholder/error messages centered correctly.
          // For simplicity, we clear it; it will be redrawn on next loadData call.
          // Or, re-call displayErrorMessage/displayInfoMessage if needed.
          g.selectAll("*").remove(); // Clear if no data to render
      }
  });

  // --- Initial Load ---
  // Don't load anything by default, let the user choose.
  // The HTML's loadCuisines() will populate the dropdown.
  clearVisualization("Select a cuisine to begin.");


}); // End DOMContentLoaded listener