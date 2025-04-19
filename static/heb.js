/**
 * /static/heb.js
 * Main D3.js script for ingredient visualization dashboard.
 * Includes: HEB, Top Ingredients Bar, Top Pairs Bar, Adjacency Matrix (Top 15)
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Visualization...");

    // --- Configuration ---
    const container = d3.select("#chart-container");
    const controls = d3.select("#controls");
    const chartButtonsContainer = d3.select("#chart-buttons");
    const searchInput = d3.select("#search-input");
    const clearHighlightButton = d3.select("#clear-highlight-button");
    const vizHeight = Math.min(700, window.innerHeight * 0.8);
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10); // Color scale for nodes/categories
    const lineColors = [ // Specific colors for HEB links
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
        "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5"
    ];
    // Margins for different charts
    const barChartMargin = { top: 30, right: 30, bottom: 120, left: 180 };
    const pairBarChartMargin = { top: 30, right: 30, bottom: 120, left: 200 };
    const matrixMargin = { top: 120, right: 30, bottom: 120, left: 120 }; // Margins for matrix labels
    const initialHebScale = 0.9; // Initial zoom scale for HEB
    const hebVerticalOffset = 0; // Vertical offset for HEB center
    const MATRIX_TOP_N = 15; // Number of top ingredients for the Adjacency Matrix

    // --- State Variables ---
    let currentWidth = container.node()?.getBoundingClientRect().width || 800;
    let currentCuisineData = null; // Stores raw { hierarchy: ..., links: ... }
    let currentChartType = 'heb'; // Active chart: 'heb', 'bar', 'pairs-bar', 'matrix'
    let radius, barChartWidth, barChartHeight, pairBarChartWidth, pairBarChartHeight, matrixWidth, matrixHeight; // Chart dimensions

    // --- SVG Setup ---
    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", vizHeight)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("overflow", "visible");

    // Create dedicated groups for each chart type
    const g = svg.append("g").attr("class", "heb-group");
    const barG = svg.append("g").attr("class", "bar-group");
    const pairBarG = svg.append("g").attr("class", "pair-bar-group");
    const matrixG = svg.append("g").attr("class", "matrix-group"); // Group for Matrix

    // --- D3 Layout Helpers ---
    const lineRadial = d3.lineRadial() // For HEB links
        .curve(d3.curveBundle.beta(0.95))
        .radius(d => d.y)
        .angle(d => d.x * Math.PI / 180);

    // --- Zoom Behavior (Only for HEB) ---
    const zoom = d3.zoom()
        .scaleExtent([0.5, 3]) // Min/max zoom levels
        .on('zoom', (event) => {
            if (currentChartType === 'heb') {
                g.attr('transform', event.transform); // Apply zoom transform only to HEB group
            }
        });
    svg.call(zoom).on("dblclick.zoom", null); // Apply zoom to SVG but disable double-click zoom

    // --- Zoom Helper Functions (for HEB) ---
    function getInitialHebTransform() {
        // Calculate center based on current dimensions
        return d3.zoomIdentity
            .translate(currentWidth / 2, vizHeight / 2 + hebVerticalOffset)
            .scale(initialHebScale);
    }
    function resetHEBView() {
        if (currentChartType === 'heb') { // Only reset if HEB is active
            svg.transition().duration(750)
               .call(zoom.transform, getInitialHebTransform()); // Transition to initial state
        }
    }
    // Attach reset view listener
    document.getElementById('reset-view')?.addEventListener('click', resetHEBView);

    // --- Core Functions ---

    // Calculate radius for HEB based on container width/height
    function calculateRadius(width) {
        const containerPadding = 40; // Account for potential padding
        return Math.min(
          (width - containerPadding) * 0.9,
          (vizHeight - containerPadding) * 0.9
        ) * 0.5; // Use half for radius calculation (diameter fills 60%)
    }

    // Update SVG and chart dimensions on load/resize
    function updateSvgDimensions() {
        currentWidth = container.node()?.getBoundingClientRect().width || 800;
        svg.attr("width", currentWidth).attr("height", vizHeight);

        // Calculate dimensions for each chart type
        radius = calculateRadius(currentWidth);
        barChartWidth = Math.max(200, currentWidth - barChartMargin.left - barChartMargin.right);
        barChartHeight = Math.max(150, vizHeight - barChartMargin.top - barChartMargin.bottom);
        pairBarChartWidth = Math.max(200, currentWidth - pairBarChartMargin.left - pairBarChartMargin.right);
        pairBarChartHeight = Math.max(150, vizHeight - pairBarChartMargin.top - pairBarChartMargin.bottom);
        matrixWidth = Math.max(150, currentWidth - matrixMargin.left - matrixMargin.right); // Matrix dimensions
        matrixHeight = Math.max(150, vizHeight - matrixMargin.top - matrixMargin.bottom); // Matrix dimensions

        // Manage visibility and static transforms for each group
        g.style("display", currentChartType === 'heb' ? "block" : "none"); // HEB transform handled by zoom

        barG.attr("transform", `translate(${barChartMargin.left},${barChartMargin.top})`)
            .style("display", currentChartType === 'bar' ? "block" : "none");

        pairBarG.attr("transform", `translate(${pairBarChartMargin.left},${pairBarChartMargin.top})`)
               .style("display", currentChartType === 'pairs-bar' ? "block" : "none");

        matrixG.attr("transform", `translate(${matrixMargin.left},${matrixMargin.top})`) // Matrix transform
               .style("display", currentChartType === 'matrix' ? "block" : "none");    // Matrix display

        // If HEB is the current chart, update its zoom transform's center point on resize
        if (currentChartType === 'heb') {
            const currentTransform = d3.zoomTransform(svg.node()); // Get current zoom state
            const newTranslateX = currentWidth / 2;
            const newTranslateY = vizHeight / 2 + hebVerticalOffset;
            // Create a new transform keeping the scale but updating translation
            const recenteredTransform = d3.zoomIdentity
                 .translate(newTranslateX, newTranslateY)
                 .scale(currentTransform.k); // Keep current scale
            // Apply the recentered transform immediately (no transition on resize)
            svg.call(zoom.transform, recenteredTransform);
        }
    }

    // Fetch data for the selected cuisine from the API
    async function loadData(cuisineName) {
        if (!cuisineName) {
            clearVisualization("Select a cuisine from the list.");
            updateTitle("Ingredient Relationships");
            currentCuisineData = null;
            return;
        }
        setLoadingState(true, cuisineName); // Show loading state
        currentCuisineData = null; // Clear old data
        clearHighlight(); // Clear any search highlights

        try {
            const response = await fetch(`/api/heb/${cuisineName}`); // API endpoint
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            // Basic data validation (required for most charts)
            if (!data || !data.hierarchy || !data.links) {
                console.error("Incomplete data received:", data);
                throw new Error(`Incomplete data for ${cuisineName}. Requires hierarchy and links.`);
            }
            // Specific check for matrix ranking requirement
            if (!data.hierarchy.children) {
                 console.warn("Data lacks hierarchy.children. Matrix ranking may fail or be incomplete.");
            }

            currentCuisineData = data; // Store fetched data
            updateTitle(`${cuisineName} - Ingredient Analysis`); // Update dashboard title
            renderCurrentChart(); // Render the currently selected chart type

        } catch (error) {
            console.error(`Error loading data for ${cuisineName}:`, error);
            displayErrorMessage(`Failed to load data for ${cuisineName}. Please try again or select another cuisine.`);
            currentCuisineData = null;
        } finally {
            setLoadingState(false); // Hide loading state
        }
    }

    // --- Data Processing Functions ---

    // Process data specifically for Hierarchical Edge Bundling
    function processDataForHEB(rawData) {
        console.log("Processing data for HEB...");
        if (!rawData?.links || !rawData?.hierarchy) return { error: "Links & hierarchy needed for HEB." };

        // Filter links by strength (co-occurrence value)
        const filteredLinks = rawData.links.filter(link => link.value > 2);
        if (filteredLinks.length === 0) return { error: "No strong ingredient connections (value > 2) found for HEB." };

        // Calculate node degrees based on strong links
        const nodeDegrees = {};
        const nodesInFilteredLinks = new Set();
        filteredLinks.forEach(link => {
            nodeDegrees[link.source] = (nodeDegrees[link.source] || 0) + 1;
            nodeDegrees[link.target] = (nodeDegrees[link.target] || 0) + 1;
            nodesInFilteredLinks.add(link.source);
            nodesInFilteredLinks.add(link.target);
        });

        // Filter the hierarchy: keep leaf nodes only if they have degree > 1 in strong links
        const filteredHierarchy = filterHierarchy(rawData.hierarchy, node => {
            if (!node.children) return nodesInFilteredLinks.has(node.name) && nodeDegrees[node.name] > 1;
            return true; // Keep internal nodes initially
        });

        if (!filteredHierarchy?.children?.length) return { error: "No significant ingredient clusters found after filtering for HEB." };

        // Get names of leaf nodes that survived the filtering
        const survivingLeafNodeNames = new Set();
        function collectLeafNames(node) {
            if (!node.children && node.name) survivingLeafNodeNames.add(node.name);
            if (node.children) node.children.forEach(collectLeafNames);
        }
        collectLeafNames(filteredHierarchy);

        // Final filter for links: both source and target must be surviving leaf nodes
        const finalLinks = filteredLinks.filter(link =>
            survivingLeafNodeNames.has(link.source) && survivingLeafNodeNames.has(link.target)
        );

        if (finalLinks.length === 0) return { error: "No connections remain between filtered ingredients for HEB." };

        // Create D3 hierarchy and cluster layout
        const root = d3.hierarchy(filteredHierarchy)
            .sum(d => d.value || 1) // Use value if present, otherwise count as 1
            .sort((a, b) => d3.ascending(a.data.name, b.data.name)); // Sort nodes alphabetically

        const cluster = d3.cluster()
            .size([360, radius]); // Use calculated radius for layout size
        cluster(root); // Apply cluster layout to the root

        const nodeMap = new Map(root.leaves().map(d => [d.data.name, d])); // Map names to D3 node objects

        console.log(`HEB Processed: ${nodeMap.size} nodes, ${finalLinks.length} links.`);
        return { root, finalLinks, nodeMap }; // Return data needed for rendering
    }

    // Process data for Top Ingredients Bar Chart (based on occurrence)
    function processDataForBarChart(rawData, topN = 20) {
        console.log("Processing data for Top Ingredients Bar Chart...");
         if (!rawData?.hierarchy?.children) {
             console.warn("No hierarchy.children found for bar chart processing.");
             return { error: "Ingredient occurrence data (hierarchy children) not available." };
        }
        // Extract and validate ingredient data
        const ingredients = rawData.hierarchy.children;
        const validIngredients = ingredients
            .filter(item => item?.name && typeof item.value === 'number' && item.value >= 0)
            .map(item => ({ name: item.name, value: item.value }));

        if (validIngredients.length === 0) return { error: "No valid ingredient occurrence data found." };

        // Sort by occurrence value and take top N
        const sortedNodes = validIngredients.sort((a, b) => b.value - a.value).slice(0, topN);

        if (sortedNodes.length === 0) return { error: "No ingredients remaining after sorting/filtering." };

        console.log(`Top Ingredients Bar Processed: ${sortedNodes.length} nodes.`);
        return { sortedNodes };
    }

    // Process data for Top Ingredient Pairs Bar Chart (based on link value)
    function processDataForPairsBarChart(rawData, topN = 20) {
        console.log("Processing data for Top Pairs Bar Chart...");
         if (!rawData?.links) return { error: "Link data is required for Top Pairs chart." };
         if (rawData.links.length === 0) return { error: "No links (pairs) available." };

         // Sort links by co-occurrence value and take top N
         const sortedLinks = [...rawData.links]
             .filter(link => link.value > 0 && link.source && link.target) // Ensure links are valid
             .sort((a, b) => b.value - a.value)
             .slice(0, topN);

         // Format data for the chart
         const chartData = sortedLinks.map(link => ({
             pairLabel: [link.source, link.target].sort().join(' & '), // Consistent A & B label
             value: link.value,
             source: link.source, // Keep original source/target for potential interaction
             target: link.target
         }));

         if (chartData.length === 0) return { error: "No valid pairs found after sorting/filtering." };

         console.log(`Top Pairs Bar Processed: ${chartData.length} pairs.`);
         return { sortedPairs: chartData };
    }

    // Process data for Adjacency Matrix (Top N Ingredients by Occurrence)
    function processDataForMatrix(rawData, topN = MATRIX_TOP_N) {
        console.log(`Processing data for Adjacency Matrix (Top ${topN} ingredients)...`);
        // Check for required data: links and hierarchy with children for ranking
        if (!rawData?.links) return { error: "Link data is required for the Adjacency Matrix." };
        if (!rawData?.hierarchy?.children) {
             console.error("Hierarchy data with children (for occurrence counts) is required to determine top ingredients for the matrix.");
             return { error: `Hierarchy data needed to rank Top ${topN} ingredients for Matrix.` };
        }

        // 1. Get Top N ingredients based on occurrence count from hierarchy
        const ingredientsWithOccurrences = rawData.hierarchy.children
            .filter(item => item?.name && typeof item.value === 'number' && item.value >= 0)
            .map(item => ({ name: item.name, value: item.value }));

        if (ingredientsWithOccurrences.length === 0) {
            return { error: "No valid ingredient occurrence data found to rank for Matrix."};
        }

        const topIngredients = ingredientsWithOccurrences
            .sort((a, b) => b.value - a.value) // Sort descending by occurrence
            .slice(0, topN);                     // Take the top N

        if (topIngredients.length === 0) {
             return { error: `Could not determine Top ${topN} ingredients.`};
        }

        // 2. Get the names of these top ingredients and sort them alphabetically for matrix axes
        const topIngredientNames = topIngredients.map(d => d.name).sort();
        const topIngredientSet = new Set(topIngredientNames); // Use a Set for efficient lookup later

        console.log(`Selected Top ${topIngredientNames.length} ingredients for Matrix:`, topIngredientNames.join(', '));

        // 3. Filter raw links to include only connections *between* these top ingredients
        const filteredLinks = rawData.links.filter(link =>
            link.source && link.target && // Ensure link has source and target
            topIngredientSet.has(link.source) &&
            topIngredientSet.has(link.target)
        );

        if (filteredLinks.length === 0) {
             console.warn(`No links found between the selected Top ${topIngredientNames.length} ingredients. Matrix cells will be empty.`);
             // Proceed, but expect an empty grid
        }

        // 4. Create the matrix grid data structure based on the alphabetically sorted topIngredientNames
        const nodeIndex = new Map(topIngredientNames.map((name, i) => [name, i]));
        const matrix = topIngredientNames.map((sourceName, i) => {
            return topIngredientNames.map((targetName, j) => {
                // Initialize each cell object
                return { x: j, y: i, z: 0, source: sourceName, target: targetName }; // z = co-occurrence value
            });
        });

        // 5. Populate the matrix grid with values from the *filtered* links
        let maxValue = 0;
        filteredLinks.forEach(link => {
            const sourceIndex = nodeIndex.get(link.source);
            const targetIndex = nodeIndex.get(link.target);
            // Indices should always be valid here due to pre-filtering
            if (sourceIndex !== undefined && targetIndex !== undefined) {
                 const value = link.value || 0;
                 matrix[sourceIndex][targetIndex].z += value;
                 // Add value to the symmetric position for undirected graph representation
                 if (sourceIndex !== targetIndex) {
                    matrix[targetIndex][sourceIndex].z += value;
                 }
                 // Update max value found in the matrix
                 maxValue = Math.max(maxValue, matrix[sourceIndex][targetIndex].z, matrix[targetIndex][sourceIndex].z);
            }
        });

        console.log(`Matrix Processed: ${topIngredientNames.length} nodes, Max value: ${maxValue}.`);
        // Return the sorted node names, the populated matrix grid, and the max value for color scaling
        return { nodes: topIngredientNames, matrix, maxValue };
    }


    // --- Chart Rendering Functions ---

    // Main function to dispatch rendering based on currentChartType
    function renderCurrentChart() {
        console.log(`renderCurrentChart called. Type: ${currentChartType}, Data loaded: ${!!currentCuisineData}`);
        // Ensure data is loaded before attempting to render
        if (!currentCuisineData) {
            const selectValue = document.getElementById("cuisine-select")?.value;
            clearVisualization(selectValue ? "" : "Select a cuisine to begin."); // Show message if no cuisine selected
             if (selectValue) console.warn("renderCurrentChart: No data available, cannot render.");
            updateSvgDimensions(); // Still update dimensions to hide/show groups correctly
            return;
        }

        clearVisualization(); // Clear previous chart drawings
        updateSvgDimensions(); // Ensure dimensions and group visibility are correct

        try {
            let processed = null;       // To hold processed data
            let renderFunction = null;  // To hold the correct render function
            let requiredDataCheck = () => true; // Function to check if necessary data exists

            // Determine processing and rendering based on chart type
            switch (currentChartType) {
                case 'heb':
                    requiredDataCheck = () => !!currentCuisineData.links && !!currentCuisineData.hierarchy;
                    if (!requiredDataCheck()) { displayErrorMessage("Links & hierarchy data are needed for HEB view."); return; }
                    processed = processDataForHEB(currentCuisineData);
                    renderFunction = renderHEB;
                    break;
                case 'bar':
                    requiredDataCheck = () => !!currentCuisineData.hierarchy?.children;
                    if (!requiredDataCheck()) { displayErrorMessage("Ingredient occurrence data (hierarchy children) needed for Top Ingredients chart."); return; }
                    processed = processDataForBarChart(currentCuisineData);
                    renderFunction = renderBarChart;
                    break;
                case 'pairs-bar':
                    requiredDataCheck = () => !!currentCuisineData.links;
                     if (!requiredDataCheck()) { displayErrorMessage("Link data is needed for Top Pairs chart."); return; }
                    processed = processDataForPairsBarChart(currentCuisineData);
                    renderFunction = renderPairsBarChart;
                    break;
                 case 'matrix': // Adjacency Matrix Case
                    // Requires hierarchy for ranking and links for connections
                    requiredDataCheck = () => !!currentCuisineData.links && !!currentCuisineData.hierarchy?.children;
                    if (!requiredDataCheck()) { displayErrorMessage(`Link data and Hierarchy (with children) needed for Top ${MATRIX_TOP_N} Matrix view.`); return; }
                    processed = processDataForMatrix(currentCuisineData); // Uses top N logic
                    renderFunction = renderAdjacencyMatrix; // Use matrix renderer
                    break;
                default:
                    // Fallback for unknown type
                    console.error(`Unknown chart type encountered: ${currentChartType}`);
                    displayErrorMessage(`Invalid chart type selected. Resetting to default.`);
                    currentChartType = 'heb'; // Reset to default
                    setActiveButton('heb-button');
                    renderCurrentChart(); // Attempt re-render with default
                    return;
            }

            // Execute rendering or display messages
            if (processed?.error) {
                displayInfoMessage(processed.error); // Show info message for processing errors (e.g., no data after filtering)
            } else if (processed && renderFunction) {
                renderFunction(processed); // Call the specific render function
                // Re-apply search highlight if a search term exists
                 const currentSearchTerm = searchInput.node().value;
                 if (currentSearchTerm) {
                     highlightNodes(currentSearchTerm);
                 }
            } else {
                // Handle cases where processing didn't return data or an error object explicitly
                if(requiredDataCheck()) { // If data check passed but processing failed silently
                     displayErrorMessage(`Could not process data for the ${currentChartType} chart. Data might be malformed.`);
                 } else { // Data check failed (message likely already shown)
                     console.log(`Rendering skipped for ${currentChartType} due to initially missing data.`);
                 }
            }
        } catch (error) {
            // Catch unexpected errors during rendering
            console.error(`Error rendering ${currentChartType} chart:`, error);
            displayErrorMessage(`An unexpected error occurred while drawing the chart.`);
        }
    }

    // Renders Hierarchical Edge Bundling chart
    function renderHEB({ root, finalLinks, nodeMap }) {
        console.log("Rendering HEB chart...");
        const textScale = Math.min(1.2, Math.max(0.8, currentWidth / 1000)); // Dynamic text size
        g.selectAll("*").remove(); // Clear previous HEB elements

        // Check if data is valid after processing
        if (!root || !finalLinks || !nodeMap || nodeMap.size === 0) {
            displayInfoMessage("Not enough data remains for HEB view after filtering.");
            return;
        }

        // Ensure links only connect nodes present in the nodeMap
        let linksToDraw = finalLinks.filter(link => nodeMap.has(link.source) && nodeMap.has(link.target));
        if (linksToDraw.length !== finalLinks.length) {
            console.warn("Some HEB links were dropped because their nodes were filtered out.");
        }
        if (linksToDraw.length === 0) {
            displayInfoMessage("No connections remain between the filtered nodes for HEB view.");
            return;
        }


        // Draw Links (Paths)
        const linkSelection = g.selectAll(".link")
            .data(linksToDraw)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", d => lineRadial([nodeMap.get(d.source), nodeMap.get(d.target)])) // Generate path data
            .style("stroke", (d, i) => lineColors[i % lineColors.length]) // Cycle through colors
            .style("fill", "none")
            .style("stroke-width", d => Math.min(8, Math.max(1, Math.sqrt(d.value)))) // Width based on value
            .style("stroke-opacity", 0.6)
            .style("pointer-events", "visibleStroke"); // Allow hover events on stroke

        // Draw Nodes (Groups containing circle and text)
        const nodeSelection = g.selectAll(".node")
            .data(root.leaves()) // Use leaf nodes from the hierarchy
            .enter().append("g")
            .attr("class", "node")
            // Position nodes based on cluster layout (angle and radius)
            .attr("transform", d => `rotate(${d.x - 90}) translate(${d.y},0)`)
            .style("cursor", "pointer");

        // Node Circles
        nodeSelection.append("circle")
            .attr("r", 5) // Fixed radius for node circles
            .style("fill", d => colorScale(d.parent.data.name)) // Color by parent category
            .style("stroke", "#333")
            .style("stroke-width", 1);

        // Node Labels
        nodeSelection.append("text")
            .attr("dy", `${3 * textScale}px`) // Vertical offset based on text scale
            .attr("x", d => d.x < 180 ? 8 : -8) // Position label outside circle
            .style("text-anchor", d => d.x < 180 ? "start" : "end") // Anchor based on position
            .attr("transform", d => d.x >= 180 ? "rotate(180)" : null) // Rotate label on right side
            .style("font-size", `${10 * textScale}px`) // Dynamic font size
            .style("text-shadow", "1px 1px 2px white") // Improve readability
            .text(d => d.data.name); // Display ingredient name

        // Setup hover interactions for HEB
        setupHEBInteractivity(linkSelection, nodeSelection);

        // Apply the initial zoom/pan state AFTER rendering elements
        svg.call(zoom.transform, getInitialHebTransform());

        console.log("HEB chart rendered.");
    }

    // Renders Top Ingredients (Occurrence) Bar Chart
    function renderBarChart({ sortedNodes }) {
        console.log("Rendering Top Ingredients Bar chart...");
        barG.selectAll("*").remove(); // Clear previous bar chart elements

        if (!sortedNodes?.length) {
            displayInfoMessage("No ingredient occurrence data to display.");
            return;
        }

        // Scales
        const maxValue = d3.max(sortedNodes, d => d.value);
        const xScale = d3.scaleLinear().domain([0, maxValue > 0 ? maxValue : 1]).range([0, barChartWidth]).nice(); // Handle zero max value
        const yScale = d3.scaleBand().domain(sortedNodes.map(d => d.name)).range([0, barChartHeight]).padding(0.15);

        // Axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(Math.min(10, barChartWidth / 60)) // Dynamic number of ticks
            .tickFormat(d3.format(maxValue >= 1000 ? "~s" : ",.0f")); // Format large numbers
        const yAxis = d3.axisLeft(yScale);

        // Draw Axes
        barG.append("g").attr("class", "x axis").attr("transform", `translate(0,${barChartHeight})`).call(xAxis)
            .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-65)"); // Rotate X labels
        barG.append("g").attr("class", "y axis").call(yAxis)
            .selectAll("text").style("font-size", "15px"); // Ensure Y labels are readable

        // Axis Labels
        barG.append("text").attr("class", "axis-label x-axis-title").attr("text-anchor", "middle")
            .attr("x", barChartWidth / 2).attr("y", barChartHeight + barChartMargin.bottom * 0.7)
            .text("Number of Occurrences").style("font-size", "14px");
        barG.append("text").attr("class", "axis-label y-axis-title").attr("text-anchor", "middle")
            .attr("transform", `translate(${-barChartMargin.left / 1.4}, ${barChartHeight / 2}) rotate(-90)`)
            .text("Ingredient").style("font-size", "14px");

        // Draw Bars with transition
        const barColorInterpolator = d3.interpolateBlues; // Color gradient
        const bars = barG.selectAll(".bar").data(sortedNodes).enter().append("rect")
            .attr("class", "bar")
            .attr("y", d => yScale(d.name)).attr("height", yScale.bandwidth())
            .attr("x", 0)
            .attr("fill", (d, i) => barColorInterpolator(0.8 - (i / (sortedNodes.length * 1.5)))) // Gradient effect
            .attr("width", 0); // Start width at 0 for transition
        bars.transition().duration(750).delay((d, i) => i * 25) // Staggered transition
            .attr("width", d => Math.max(0, xScale(d.value))); // Animate width
        bars.append("title").text(d => `${d.name}: ${d.value.toLocaleString()} occurrences`); // Tooltip

        console.log("Top Ingredients Bar chart rendered.");
    }

    // Renders Top Ingredient Pairs Bar Chart
    function renderPairsBarChart({ sortedPairs }) {
        console.log("Rendering Top Pairs Bar chart...");
        pairBarG.selectAll("*").remove(); // Clear previous pairs bar chart elements

        if (!sortedPairs?.length) {
            displayInfoMessage("No ingredient pair data to display.");
            return;
        }

        // Scales
        const maxValue = d3.max(sortedPairs, d => d.value);
        const xScale = d3.scaleLinear().domain([0, maxValue > 0 ? maxValue : 1]).range([0, pairBarChartWidth]).nice();
        const yScale = d3.scaleBand().domain(sortedPairs.map(d => d.pairLabel)).range([0, pairBarChartHeight]).padding(0.15);

        // Axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(Math.min(8, pairBarChartWidth / 70))
            .tickFormat(d3.format(maxValue >= 1000 ? "~s" : ",.0f"));
        const yAxis = d3.axisLeft(yScale);

        // Draw Axes
        pairBarG.append("g").attr("class", "x axis").attr("transform", `translate(0,${pairBarChartHeight})`).call(xAxis)
            .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-45)"); // Rotate X labels
        pairBarG.append("g").attr("class", "y axis").call(yAxis)
            .selectAll("text").style("font-size", "15px"); // Ensure Y labels are readable

        // Axis Labels
        pairBarG.append("text").attr("class", "axis-label x-axis-title").attr("text-anchor", "middle")
            .attr("x", pairBarChartWidth / 2).attr("y", pairBarChartHeight + pairBarChartMargin.bottom * 0.7)
            .text("Co-occurrence Strength (Value)").style("font-size", "14px");
        pairBarG.append("text").attr("class", "axis-label y-axis-title").attr("text-anchor", "middle")
            .attr("transform", `translate(${-pairBarChartMargin.left / 1.4}, ${pairBarChartHeight / 2}) rotate(-90)`)
            .text("Ingredient Pair").style("font-size", "14px");

        // Draw Bars with transition
        const bars = pairBarG.selectAll(".bar").data(sortedPairs).enter().append("rect")
            .attr("class", "bar")
            .attr("y", d => yScale(d.pairLabel)).attr("height", yScale.bandwidth())
            .attr("x", 0)
            .attr("fill", (d, i) => d3.interpolateBlues(1 - i / (sortedPairs.length * 1.5))) // Gradient effect
            .attr("width", 0); // Start width at 0
        bars.transition().duration(750).delay((d, i) => i * 20) // Staggered transition
            .attr("width", d => Math.max(0, xScale(d.value))); // Animate width
        bars.append("title").text(d => `${d.pairLabel}: ${d.value.toLocaleString()}`); // Tooltip

        console.log("Top Pairs Bar chart rendered.");
    }

    // Renders Adjacency Matrix for Top N Ingredients
    function renderAdjacencyMatrix({ nodes, matrix, maxValue }) {
        console.log("Rendering Adjacency Matrix...");
        matrixG.selectAll("*").remove(); // Clear previous matrix elements

        // Check for valid data (nodes array and matrix grid)
        if (!nodes?.length || !matrix?.length) {
            displayInfoMessage("Not enough processed data to render the Adjacency Matrix.");
            return;
        }

        // Scales
        const xScale = d3.scaleBand() // Band scale for discrete nodes on X axis
            .domain(nodes) // Domain is the sorted list of top ingredient names
            .range([0, matrixWidth])
            .paddingInner(0.05); // Padding between cells
        const yScale = d3.scaleBand() // Band scale for discrete nodes on Y axis
            .domain(nodes) // Same domain as X axis
            .range([0, matrixHeight])
            .paddingInner(0.05);

        // Color scale for cell values (co-occurrence strength)
        const colorScaleMatrix = d3.scaleSequential(d3.interpolateBlues) // Blue gradient
            .domain([0, maxValue > 0 ? maxValue : 1]); // Domain from 0 to max value found

        // Axes
        const xAxis = d3.axisTop(xScale).tickSize(0); // X axis on top, no tick lines
        const yAxis = d3.axisLeft(yScale).tickSize(0); // Y axis on left, no tick lines

        // Draw Axes and style labels
        matrixG.append("g").attr("class", "x axis")
            .call(xAxis)
            .selectAll("text")
                .style("text-anchor", "start") // Anchor rotated labels
                .attr("dx", ".8em").attr("dy", ".15em")
                .attr("transform", "rotate(-65)"); // Rotate X labels for readability

        matrixG.append("g").attr("class", "y axis")
            .call(yAxis);

        // Remove the actual axis lines if desired
        matrixG.selectAll(".axis").select(".domain").remove();

        // Draw Cells (Rectangles)
        // Flatten the matrix grid and filter out cells with zero value for efficiency
        const cellsData = matrix.flat().filter(d => d.z > 0);

        const cells = matrixG.selectAll(".matrix-cell")
            .data(cellsData, d => `${d.source}-${d.target}`) // Use unique key for object constancy
            .enter().append("rect")
            .attr("class", "matrix-cell")
            .attr("x", d => xScale(d.target)) // X position based on target ingredient
            .attr("y", d => yScale(d.source)) // Y position based on source ingredient
            .attr("width", xScale.bandwidth()) // Width determined by band scale
            .attr("height", yScale.bandwidth()) // Height determined by band scale
            .style("fill", d => colorScaleMatrix(d.z)) // Fill color based on value
            .style("opacity", 0); // Start transparent for fade-in effect

        // Add tooltips to cells
        cells.append("title")
             .text(d => `${d.source} & ${d.target}: ${d.z.toLocaleString()}`);

        // Fade in cells
        cells.transition().duration(750)
             .style("opacity", 1);

        // Setup hover interactions for the matrix
        setupMatrixInteractivity(cells);

        console.log(`Adjacency Matrix rendered with ${nodes.length} nodes.`);
    }


    // --- Interactivity & Highlighting ---

    // Setup hover interactions for HEB nodes and links
    function setupHEBInteractivity(linkSelection, nodeSelection) {
         console.log("Setting up HEB Interactivity...");
        if (!linkSelection || !nodeSelection || linkSelection.empty() || nodeSelection.empty()) {
             console.warn("setupHEBInteractivity: Invalid or empty selections provided."); return;
        }
        // Link hover: Dim others, highlight hovered link and connected nodes
        linkSelection
            .on("mouseover.heb", function (event, d) {
                const sourceName = d.source; const targetName = d.target;
                linkSelection.style("stroke-opacity", 0.1); // Dim all links
                nodeSelection.style("opacity", 0.2);     // Dim all nodes
                // Highlight hovered link
                d3.select(this).style("stroke-opacity", 0.9)
                  .style("stroke-width", dd => Math.min(10, Math.max(1.5, Math.sqrt(dd.value) * 1.5))) // Thicken
                  .raise(); // Bring to front
                // Highlight connected nodes
                nodeSelection.filter(nd => nd.data.name === sourceName || nd.data.name === targetName)
                  .style("opacity", 1.0).select("circle").style("stroke-width", 2.0).style("stroke", "#333");
                nodeSelection.filter(nd => nd.data.name === sourceName || nd.data.name === targetName)
                  .select("text").style("font-weight", "bold");
            }).on("mouseout.heb", function () { // Restore default styles on mouseout
                linkSelection.style("stroke-opacity", 0.6)
                  .style("stroke-width", dd => Math.min(8, Math.max(1, Math.sqrt(dd.value))));
                nodeSelection.style("opacity", 1.0).select("circle")
                  .style("stroke-width", 1).style("stroke", "#333");
                nodeSelection.select("text").style("font-weight", "400");
            });
        // Node hover: Dim others, highlight hovered node, connected links, and neighbor nodes
        nodeSelection
            .on("mouseover.heb", function(event, d) {
                const nodeName = d.data.name;
                linkSelection.style("stroke-opacity", 0.1); // Dim all
                nodeSelection.style("opacity", 0.2);
                // Highlight hovered node
                const currentNode = d3.select(this); currentNode.style("opacity", 1.0).raise();
                currentNode.select("circle").style("stroke-width", 2.5).style("stroke", "#000");
                currentNode.select("text").style("font-weight", "bold");
                // Find and highlight connected links and neighbors
                const connectedNodeNames = new Set(); const connectedLinkElements = [];
                linkSelection.each(function(ld) { // Iterate through link data
                    let linkConnected = false;
                    if (ld.source === nodeName) { connectedNodeNames.add(ld.target); linkConnected = true; }
                    if (ld.target === nodeName) { connectedNodeNames.add(ld.source); linkConnected = true; }
                    if (linkConnected) connectedLinkElements.push(this); // Store link element
                });
                d3.selectAll(connectedLinkElements).style("stroke-opacity", 0.9) // Highlight links
                  .style("stroke-width", dd => Math.min(10, Math.max(1.5, Math.sqrt(dd.value) * 1.5))).raise();
                // Highlight neighbor nodes
                nodeSelection.filter(nd => connectedNodeNames.has(nd.data.name)).style("opacity", 1.0)
                    .select("circle").style("stroke-width", 2.0).style("stroke", "#333");
                nodeSelection.filter(nd => connectedNodeNames.has(nd.data.name))
                    .select("text").style("font-weight", "500"); // Semi-bold neighbors
            }).on("mouseout.heb", function() { // Restore defaults on mouseout
                 linkSelection.style("stroke-opacity", 0.6)
                   .style("stroke-width", dd => Math.min(8, Math.max(1, Math.sqrt(dd.value))));
                 nodeSelection.style("opacity", 1.0).select("circle")
                   .style("stroke-width", 1).style("stroke", "#333");
                 nodeSelection.select("text").style("font-weight", "400");
            });
         console.log("HEB Interactivity setup complete.");
    }

    // Setup hover interactions for Adjacency Matrix cells and axes
    function setupMatrixInteractivity(cellSelection) {
         console.log("Setting up Matrix Interactivity...");
        if (!cellSelection || cellSelection.empty()) {
            console.warn("setupMatrixInteractivity: Invalid or empty cell selection."); return;
        }
        // Select all relevant elements for dimming/highlighting
        const allCells = matrixG.selectAll(".matrix-cell");
        const allXAxisTicks = matrixG.selectAll(".x.axis .tick");
        const allYAxisTicks = matrixG.selectAll(".y.axis .tick");

        // Cell hover: Highlight cell, corresponding row/column labels, and related cells
        cellSelection
            .on("mouseover.matrix", function(event, d) { // d is cell data {x,y,z,source,target}
                allCells.style("opacity", 0.3); // Dim all cells
                allXAxisTicks.style("opacity", 0.3); // Dim X ticks
                allYAxisTicks.style("opacity", 0.3); // Dim Y ticks
                // Highlight hovered cell
                d3.select(this).style("opacity", 1).raise();
                // Highlight corresponding axis ticks
                allXAxisTicks.filter(nodeName => nodeName === d.target) // Match target on X axis
                             .style("opacity", 1).select("text").style("font-weight", "bold");
                allYAxisTicks.filter(nodeName => nodeName === d.source) // Match source on Y axis
                             .style("opacity", 1).select("text").style("font-weight", "bold");
                 // Optional: Partially highlight other cells in the same row/column
                 allCells.filter(cellData => cellData.source === d.source || cellData.target === d.target)
                         .style("opacity", 0.7);
            })
            .on("mouseout.matrix", function() { // Restore defaults on mouseout
                allCells.style("opacity", 1);
                allXAxisTicks.style("opacity", 1).select("text").style("font-weight", "normal");
                allYAxisTicks.style("opacity", 1).select("text").style("font-weight", "normal");
            });

        // Y-Axis Tick hover: Highlight tick, corresponding row cells, and target ticks
         allYAxisTicks.on("mouseover.matrix", function(event, d_row) { // d_row is the ingredient name
             allCells.style("opacity", 0.3); allXAxisTicks.style("opacity", 0.3); allYAxisTicks.style("opacity", 0.3);
             // Highlight tick itself
             d3.select(this).style("opacity", 1).select("text").style("font-weight", "bold");
             // Highlight cells in this row
             allCells.filter(cellData => cellData.source === d_row).style("opacity", 1);
              // Highlight corresponding X-axis ticks (targets) for cells in this row
              const targetNodes = new Set();
              allCells.filter(cellData => cellData.source === d_row && cellData.z > 0).each(cd => targetNodes.add(cd.target));
              allXAxisTicks.filter(nodeName => targetNodes.has(nodeName)).style("opacity", 1);
         }).on("mouseout.matrix", function() { // Restore defaults
             allCells.style("opacity", 1); allXAxisTicks.style("opacity", 1).select("text").style("font-weight", "normal"); allYAxisTicks.style("opacity", 1).select("text").style("font-weight", "normal");
         });

        // X-Axis Tick hover: Highlight tick, corresponding column cells, and source ticks
        allXAxisTicks.on("mouseover.matrix", function(event, d_col) { // d_col is the ingredient name
             allCells.style("opacity", 0.3); allXAxisTicks.style("opacity", 0.3); allYAxisTicks.style("opacity", 0.3);
             // Highlight tick itself
             d3.select(this).style("opacity", 1).select("text").style("font-weight", "bold");
             // Highlight cells in this column
             allCells.filter(cellData => cellData.target === d_col).style("opacity", 1);
              // Highlight corresponding Y-axis ticks (sources) for cells in this column
              const sourceNodes = new Set();
              allCells.filter(cellData => cellData.target === d_col && cellData.z > 0).each(cd => sourceNodes.add(cd.source));
              allYAxisTicks.filter(nodeName => sourceNodes.has(nodeName)).style("opacity", 1);
         }).on("mouseout.matrix", function() { // Restore defaults
             allCells.style("opacity", 1); allXAxisTicks.style("opacity", 1).select("text").style("font-weight", "normal"); allYAxisTicks.style("opacity", 1).select("text").style("font-weight", "normal");
         });

         console.log("Matrix Interactivity setup complete.");
    }

    // Highlight elements across charts based on search term
    function highlightNodes(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        console.log(`Highlighting nodes for term: "${term}" on chart: ${currentChartType}`);
        clearHighlight(false); // Clear previous highlights but keep search term
        if (!term) return; // Do nothing if search is empty

        let nodesToHighlight = new Set(); // Set of primary matching ingredient names
        let neighborsToHighlight = new Set(); // Set of neighbors (connected to primary matches)
        let linksToHighlight = new Set(); // Set of HEB link elements to highlight

        // Apply highlighting logic based on the currently active chart
        if (currentChartType === 'heb') {
            const allNodes = g.selectAll(".node"); const allLinks = g.selectAll(".link");
            // Find primary matches
            allNodes.each(function(d) { if (d.data.name?.toLowerCase().includes(term)) nodesToHighlight.add(d.data.name); });

            if (nodesToHighlight.size > 0) {
                allNodes.classed("dimmed", true); allLinks.classed("dimmed", true); // Dim everything
                // Find neighbors and connected links
                allLinks.each(function(d) {
                    let linkConnected = false;
                    if (nodesToHighlight.has(d.source)) { neighborsToHighlight.add(d.target); linkConnected = true; }
                    if (nodesToHighlight.has(d.target)) { neighborsToHighlight.add(d.source); linkConnected = true; }
                    if (linkConnected) linksToHighlight.add(this); // Add link DOM element
                });
                nodesToHighlight.forEach(name => neighborsToHighlight.delete(name)); // Don't highlight self as neighbor
                // Apply highlight classes
                allNodes.filter(d => nodesToHighlight.has(d.data.name)).classed("dimmed", false).classed("highlighted", true).raise();
                allNodes.filter(d => neighborsToHighlight.has(d.data.name)).classed("dimmed", false).classed("highlighted-neighbor", true);
                d3.selectAll(Array.from(linksToHighlight)).classed("dimmed", false).classed("highlighted", true).raise();
            }
        } else if (currentChartType === 'bar' || currentChartType === 'pairs-bar') {
           const targetGroup = (currentChartType === 'bar') ? barG : pairBarG;
           const allBars = targetGroup.selectAll(".bar");
           const allYAxisTicks = targetGroup.selectAll(".y.axis .tick"); // Select tick groups
           allBars.classed("dimmed", true); allYAxisTicks.classed("dimmed", true); // Dim all
           // Highlight matching bars
           allBars.filter(d => {
               const label = (currentChartType === 'bar') ? d.name : d.pairLabel; // Get correct label
               return label?.toLowerCase().includes(term);
           }).classed("dimmed", false).classed("highlighted", true);
           // Highlight matching Y-axis tick text
           allYAxisTicks.filter(labelName => labelName?.toLowerCase().includes(term)) // Filter tick groups by label data
              .classed("dimmed", false) // Undim the group
              .select("text")           // Select text inside
              .classed("highlighted", true); // Highlight the text element
        } else if (currentChartType === 'matrix') {
             const allCells = matrixG.selectAll(".matrix-cell");
             const allXAxisTicks = matrixG.selectAll(".x.axis .tick");
             const allYAxisTicks = matrixG.selectAll(".y.axis .tick");

             // Find primary matches in axis ticks (data bound to ticks is the ingredient name)
             allXAxisTicks.each(nodeName => { if (nodeName?.toLowerCase().includes(term)) nodesToHighlight.add(nodeName); });
             // Y-axis has same nodes, no need to check again if data is consistent

             if (nodesToHighlight.size > 0) {
                 allCells.classed("dimmed", true); allXAxisTicks.classed("dimmed", true); allYAxisTicks.classed("dimmed", true); // Dim all
                 // Highlight matching axis tick text
                 allXAxisTicks.filter(nodeName => nodesToHighlight.has(nodeName))
                              .classed("dimmed", false).select("text").classed("highlighted", true);
                 allYAxisTicks.filter(nodeName => nodesToHighlight.has(nodeName))
                              .classed("dimmed", false).select("text").classed("highlighted", true);
                // Find neighbors and classify cells
                allCells.each(function(d) { // d is cell data {x,y,z,source,target}
                    let isPrimaryCell = false;    // Cell connects two highlighted nodes
                    let isNeighborCell = false;   // Cell connects a highlighted node and a neighbor
                    if (nodesToHighlight.has(d.source) && nodesToHighlight.has(d.target)) {
                        isPrimaryCell = true;
                    } else if (nodesToHighlight.has(d.source)) {
                        neighborsToHighlight.add(d.target); isNeighborCell = true;
                    } else if (nodesToHighlight.has(d.target)) {
                        neighborsToHighlight.add(d.source); isNeighborCell = true;
                    }
                    // Apply highlight classes to cells
                    if (isPrimaryCell) d3.select(this).classed("dimmed", false).classed("highlighted", true);
                    else if (isNeighborCell) d3.select(this).classed("dimmed", false).classed("highlighted-neighbor", true);
                });
                // Highlight neighbor axis tick text (excluding primary matches)
                 nodesToHighlight.forEach(name => neighborsToHighlight.delete(name));
                 allXAxisTicks.filter(nodeName => neighborsToHighlight.has(nodeName))
                              .classed("dimmed", false).select("text").classed("highlighted-neighbor", true);
                 allYAxisTicks.filter(nodeName => neighborsToHighlight.has(nodeName))
                              .classed("dimmed", false).select("text").classed("highlighted-neighbor", true);
             }
        }
         console.log(`Applied highlight for "${term}". Found: ${nodesToHighlight.size} primary, ${neighborsToHighlight.size} neighbors.`);
    }

    // Clear all highlight and dimmed styles
    function clearHighlight(clearInput = true) {
        console.log("Clearing highlights...");
        // Remove classes from all potentially highlighted/dimmed elements across all charts
        svg.selectAll(".highlighted, .highlighted-neighbor, .dimmed")
           .classed("highlighted highlighted-neighbor dimmed", false);
        // Specifically remove classes from axis tick text elements
        svg.selectAll(".axis .tick text.highlighted, .axis .tick text.highlighted-neighbor")
           .classed("highlighted highlighted-neighbor", false);
        // Remove dimmed class from the tick groups themselves
        svg.selectAll(".axis .tick.dimmed").classed("dimmed", false);

        if (clearInput) {
            searchInput.node().value = ''; // Clear search input box if requested
        }
    }

    // Recursive helper function to filter D3 hierarchy based on a condition
    function filterHierarchy(node, condition) {
        if (!node) return null; // Base case: node doesn't exist

        // If it's a leaf node, apply the condition
        if (!node.children) {
            return condition(node) ? { ...node } : null; // Return copy if condition met, else null
        }

        // If it's an internal node, filter its children recursively
        const filteredChildren = node.children
            .map(child => filterHierarchy(child, condition)) // Apply filter to each child
            .filter(child => child !== null); // Remove children that were filtered out (returned null)

        // Keep the internal node only if it still has children after filtering
        if (filteredChildren.length > 0) {
            return { ...node, children: filteredChildren }; // Return copy with filtered children
        }

        // Prune the branch if no children remain
        return null;
    }

    // --- UI Helper Functions ---

    // Update the main title H1
    function updateTitle(text) {
        controls.select("h1").text(text);
    }

    // Show/hide loading indicator and dim container
    function setLoadingState(isLoading, cuisineName = '') {
        const loadingIndicator = container.select(".loading-indicator"); // Select by class
        if (isLoading) {
            updateTitle(`Loading ${cuisineName}...`); // Update title during load
            clearVisualization(); // Clear existing chart/messages
            container.style("opacity", 0.5); // Dim container background
            // Add indicator if it doesn't exist
            if (loadingIndicator.empty()) {
                 container.append("div")
                    .attr("class", "loading-indicator") // Use CSS class for styling
                    .style("position", "absolute") // Ensure it's positioned correctly
                    .style("top", "50%")
                    .style("left", "50%")
                    .style("transform", "translate(-50%, -50%)")
                    .style("padding", "10px")
                    .style("background", "rgba(255,255,255,0.8)")
                    .style("border-radius", "5px")
                    .text("Loading...");
            }
            container.select(".loading-indicator").style("display", "block"); // Show it
        } else {
            container.style("opacity", 1); // Restore container opacity
            container.select(".loading-indicator").remove(); // Remove indicator
        }
    }

    // Display an error message within the container
     function displayErrorMessage(message) {
        clearVisualization(); // Clear drawings first
        updateTitle("Error"); // Update main title
        // Determine which group is active (though message is in container div)
        const targetGroup = (currentChartType === 'heb') ? g : (currentChartType === 'bar') ? barG : (currentChartType === 'pairs-bar') ? pairBarG : (currentChartType === 'matrix') ? matrixG : svg;
        // Remove any previous messages
        container.selectAll(".error-message, .info-message").remove();
        // Add the error message div
        container.append("div")
            .attr("class", "error-message") // Use CSS class for styling
            .style("position", "absolute").style("top", "40%").style("left", "50%")
            .style("transform", "translateX(-50%)").style("text-align", "center")
            .style("background-color", "rgba(255, 204, 203, 0.9)").style("color", "#b30000")
            .style("padding", "15px").style("border", "1px solid #b30000").style("border-radius", "5px")
            .html(message); // Use html to allow potential line breaks if needed
        // Also clear the specific chart SVG group just in case
        targetGroup.selectAll("*").remove();
    }

    // Display an informational message (e.g., no data, select cuisine)
     function displayInfoMessage(message) {
        clearVisualization(); // Clear drawings first
        // Determine active group (though message is in container div)
        const targetGroup = (currentChartType === 'heb') ? g : (currentChartType === 'bar') ? barG : (currentChartType === 'pairs-bar') ? pairBarG : (currentChartType === 'matrix') ? matrixG : svg;
        // Remove previous messages
        container.selectAll(".error-message, .info-message").remove();
        // Add the info message div
        container.append("div")
             .attr("class", "info-message") // Use CSS class for styling
             .style("position", "absolute").style("top", "40%").style("left", "50%")
             .style("transform", "translateX(-50%)").style("text-align", "center")
             .style("background-color", "rgba(229, 241, 255, 0.9)").style("color", "#333")
             .style("padding", "15px").style("border", "1px solid #b3d9ff").style("border-radius", "5px")
             .text(message);
        // Clear the specific chart SVG group
        targetGroup.selectAll("*").remove();
    }

    // Clear all chart content and messages
    function clearVisualization(message = "") {
        // Clear drawing content from ALL chart groups
        g.selectAll("*").remove();
        barG.selectAll("*").remove();
        pairBarG.selectAll("*").remove();
        matrixG.selectAll("*").remove(); // Clear matrix group

        // Remove messages or loading indicators positioned in the container div
        container.selectAll(".loading-indicator, .error-message, .info-message").remove();

        // Optionally display a new info message (e.g., "Select a cuisine")
        if (message) {
             const cuisineSelected = document.getElementById("cuisine-select")?.value;
             // Only show message if no cuisine is selected or no data is loaded yet
             if (!cuisineSelected || !currentCuisineData) {
                displayInfoMessage(message);
             }
        }
    }

    // Set the 'active' class on the currently selected chart button
    function setActiveButton(activeButtonId) {
        chartButtonsContainer.selectAll("button").classed("active", false); // Remove from all
        chartButtonsContainer.select(`#${activeButtonId}`).classed("active", true); // Add to clicked one
    }


    // --- Event Listeners Setup ---

    // Cuisine Select Dropdown
    const selectElement = document.getElementById("cuisine-select");
    if (selectElement) {
        selectElement.addEventListener("change", (e) => loadData(e.target.value)); // Load data on change
    } else { console.error("Cuisine select dropdown (#cuisine-select) not found."); }

    // Chart Type Buttons
    chartButtonsContainer.selectAll("button").on("click", function() {
        const buttonId = d3.select(this).attr("id"); // Get the ID of the clicked button
        let newChartType = '';
        // Determine new chart type based on button ID
        switch (buttonId) {
            case 'heb-button': newChartType = 'heb'; break;
            case 'bar-button': newChartType = 'bar'; break;
            case 'pairs-bar-button': newChartType = 'pairs-bar'; break;
            case 'matrix-button': newChartType = 'matrix'; break; // Handle matrix button
            default: console.warn(`Unknown button ID clicked: ${buttonId}`); return; // Ignore unknown buttons
        }

        // Switch chart only if a valid new type is selected and it's different
        if (newChartType && newChartType !== currentChartType) {
            console.log(`Switching chart type to: ${newChartType}`);
            currentChartType = newChartType; // Update state variable
            setActiveButton(buttonId); // Update button appearance
            renderCurrentChart(); // Render the new chart type
            clearHighlight(); // Clear search highlight when switching charts
        }
    });

    // Search Input Listener
    searchInput.on("input", function() {
        highlightNodes(this.value); // Trigger highlight function on input
    });

    // Clear Highlight Button Listener
    clearHighlightButton.on("click", () => clearHighlight(true)); // Clear highlights and input box

    // Window Resize Listener (with debouncing)
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer); // Clear previous timer
        // Set a new timer to run after a short delay
        resizeTimer = setTimeout(() => {
            console.log("Window resized, updating layout...");
            updateSvgDimensions(); // Recalculate dimensions and update SVG
            renderCurrentChart(); // Re-render the active chart with new dimensions
        }, 250); // 250ms delay
    });

    // --- Initial Load ---
    updateSvgDimensions(); // Set initial SVG/chart dimensions
    clearVisualization("Select a cuisine to begin."); // Show initial message
    setActiveButton('heb-button'); // Set HEB as the default active button

    console.log("Visualization Initialized (with HEB, Bars, Top 15 Matrix).");

}); // End DOMContentLoaded listener