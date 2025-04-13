// Configuration - Wider container
const width = 800;  // Increased from 800 to 1200

const container = d3.select("#heb-container");
const containerWidth = container.node().getBoundingClientRect().width;
const height = 1000;  // Fixed height or make responsive if needed
const radius = Math.min(containerWidth, height) / 2 - 80;


// Create SVG
const svg = container
  .append("svg")
  .attr("width", "100%")  // Make SVG responsive to container
  .attr("height", height)
  .style("background", "transparent")  // Remove any background
  .append("g")
  .attr("transform", `translate(${containerWidth/2},${height/2})`);
// Color scale
const color = d3.scaleOrdinal(d3.schemeCategory10);
window.addEventListener("resize", function() {
    const newWidth = container.node().getBoundingClientRect().width;
    svg.attr("width", newWidth)
       .select("g")
       .attr("transform", `translate(${newWidth/2},${height/2})`);
    // You may want to re-render the visualization here if needed
  });
// Load data and initialize
async function loadData() {
    try {
      const response = await fetch(`/api/heb/russian`);
      const data = await response.json();
      renderVisualization(data);
    } catch (error) {
      console.error("Error loading data:", error);
    }
}

function renderVisualization(data) {
  svg.selectAll("*").remove();

  // First filter: Remove links with value = 1
  const filteredLinks = data.links.filter(link => link.value > 2);

  // Calculate node degrees based on filtered links
  const nodeDegrees = {};
  filteredLinks.forEach(link => {
    nodeDegrees[link.source] = (nodeDegrees[link.source] || 0) + 1;
    nodeDegrees[link.target] = (nodeDegrees[link.target] || 0) + 1;
  });

  // Second filter: Remove nodes with degree <= 1
  const filteredHierarchy = filterNodesWithLowDegree(data.hierarchy, nodeDegrees);
  
  // Final link filter: Only include links between remaining nodes
  const finalLinks = filteredLinks.filter(link => 
    nodeDegrees[link.source] > 1 && nodeDegrees[link.target] > 1
  );

  // Convert hierarchy to D3 structure
  const root = d3.hierarchy(filteredHierarchy)
    .sum(d => d.value || 1)
    .sort((a, b) => d3.ascending(a.data.name, b.data.name));

  // Create cluster layout with adjusted radius
  const cluster = d3.cluster().size([360, radius]);
  cluster(root);

  // Store leaf node positions
  const nodeMap = new Map();
  root.leaves().forEach(d => nodeMap.set(d.data.name, d));

  // Create curved edges for ingredient links
  const line = d3.lineRadial()
    .curve(d3.curveBundle.beta(1))
    .radius(d => d.y)
    .angle(d => d.x * Math.PI / 180);
    const lineColors = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
        "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5"
    ];  

  // Draw links with adjusted styling
  svg.selectAll(".link")
    .data(finalLinks)
    .enter().append("path")
    .attr("class", "link")
    .attr("d", d => {
      const source = nodeMap.get(d.source);
      const target = nodeMap.get(d.target);
      
      if (source && target) {
        return line([source, target]);
      }
      return null;
    })
    
        
        // In your link drawing code:
    .style("stroke", (d, i) => lineColors[i % lineColors.length])  // Cycle through colors
    .style("fill", "none")
    .style("stroke-width", d => Math.sqrt(d.value) * 1.2)
    .style("stroke-opacity", 0.7);
  
  // Draw nodes with improved text positioning
  svg.selectAll(".node")
    .data(root.leaves())
    .enter().append("g")
    .attr("class", "node")
    .attr("transform", d => `rotate(${d.x - 90}) translate(${d.y},0)`)
    .each(function(d) {
      d3.select(this)
        .append("circle")
        .attr("r", 6)  // Slightly larger nodes
        .style("fill", color(d.data.cuisine))
        .style("stroke", "#fff")
        .style("stroke-width", 1.5);

      // Improved text positioning for wider layout
      const textX = d.x < 180 ? 10 : -10;  // Increased offset
      const textAnchor = d.x < 180 ? "start" : "end";
      
      d3.select(this)
        .append("text")
        .attr("dy", "0.35em")
        .attr("x", textX)
        .attr("transform", d.x >= 180 ? "rotate(180)" : "")
        .style("text-anchor", textAnchor)
        .style("font-size", "11px")  // Slightly larger text
        .style("font-weight", "500")
        .text(d.data.name);
    });
}

// Helper function to filter nodes (unchanged)
function filterNodesWithLowDegree(node, degrees) {
  if (!node.children) {
    return degrees[node.name] > 1 ? node : null;
  }
  
  const filteredChildren = node.children
    .map(child => filterNodesWithLowDegree(child, degrees))
    .filter(child => child !== null);
  
  return filteredChildren.length > 0 ? {
    ...node,
    children: filteredChildren
  } : null;
}

document.getElementById("cuisine-select").addEventListener("change", () => {
  loadData();
});

// Load Scandinavian by default
loadData();