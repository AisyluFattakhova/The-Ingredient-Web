/**
 * /static/heb.js
 * Main D3.js script for ingredient visualization dashboard.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Visualization...");

    // --- Configuration ---
    const container = d3.select("#chart-container");
    const controls = d3.select("#controls");
    const chartButtonsContainer = d3.select("#chart-buttons");
    const searchInput = d3.select("#search-input");
    const clearHighlightButton = d3.select("#clear-highlight-button");
    const vizHeight = Math.min(700, window.innerHeight * 0.8); // Dynamic height
    const defaultRadiusMargin = 80; // For HEB layout
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10); // General color scale
    const lineColors = [ // Specific colors for HEB links
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
        "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5"
    ];
    // Margins for different bar charts
    const barChartMargin = { top: 30, right: 30, bottom: 120, left: 180 };
    const pairBarChartMargin = { top: 30, right: 30, bottom: 120, left: 200 };
    const initialHebScale = 0.9; // Define initial scale for HEB
    const hebVerticalOffset = 0; // Adjust Y offset for HEB center if needed

    // --- State Variables ---
    let currentWidth = container.node()?.getBoundingClientRect().width || 800;
    let currentCuisineData = null; // Stores raw data { hierarchy: ..., links: ... }
    let currentChartType = 'heb'; // Active chart: 'heb', 'network', 'bar', 'pairs-bar'
    let radius, barChartWidth, barChartHeight, pairBarChartWidth, pairBarChartHeight, networkWidth, networkHeight; // Chart dimensions
    let forceSimulation = null; // Holds the network simulation object

    const svg = container
        .append("svg")
        .attr("width", "100%")
        .attr("height", vizHeight)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("overflow", "visible"); // Allow SVG content to extend

    // Create dedicated groups for each chart type
    const g = svg.append("g").attr("class", "heb-group");
    const barG = svg.append("g").attr("class", "bar-group");
    const pairBarG = svg.append("g").attr("class", "pair-bar-group");
    const netG = svg.append("g").attr("class", "network-group");

    // --- D3 Layout Helpers ---
    const lineRadial = d3.lineRadial() // For HEB links
        .curve(d3.curveBundle.beta(0.95))
        .radius(d => d.y)
        .angle(d => d.x * Math.PI / 180);

    // --- Zoom Behavior Definition ---
    const zoom = d3.zoom()
        .scaleExtent([0.5, 3]) // Min and max zoom levels
        .on('zoom', (event) => {
            // The zoom event handler now SOLELY controls the HEB group's transform
            if (currentChartType === 'heb') {
                g.attr('transform', event.transform);
            }
            // Note: Zoom is currently only active/applied for HEB.
            // If you want zoom on other charts, you'd need to adapt this handler.
        });

    // --- Zoom Helper Functions (for HEB) ---

    // Function to calculate the desired initial transform state for HEB
    function getInitialHebTransform() {
        // Uses currentWidth and vizHeight available in the scope
        return d3.zoomIdentity
            .translate(currentWidth / 2, vizHeight / 2 + hebVerticalOffset) // Centering translation
            .scale(initialHebScale);                                        // Initial scale
    }

    // Reset function now transitions TO the calculated initial state
    function resetHEBView() {
        const initialTransform = getInitialHebTransform();
        svg.transition()
           .duration(750) // Smooth transition
           .call(zoom.transform, initialTransform); // Reset to the calculated initial state
    }

    // Apply zoom behavior to the main SVG
    svg.call(zoom)
       .on("dblclick.zoom", null); // Disable double-click zoom

    // --- Event Listeners (Top) ---
    document.getElementById('reset-view').addEventListener('click', resetHEBView);
    // Other listeners (Zoom In/Out, Pan) are removed as per your code.

    // --- Core Functions ---

    function calculateRadius(width) {
        const containerPadding = 40; // Account for container padding in CSS
        return Math.min(
          (width - containerPadding) * 0.6,
          (vizHeight - containerPadding) * 0.6 // Consider height too
        );
    }

    // Updates dimensions, transforms, and visibility based on current chart type and window size
    function updateSvgDimensions() {
        currentWidth = container.node()?.getBoundingClientRect().width || 800;
        svg.attr("width", currentWidth).attr("height", vizHeight);

        // Calculate dimensions for each chart type
        radius = calculateRadius(currentWidth);
        barChartWidth = Math.max(200, currentWidth - barChartMargin.left - barChartMargin.right);
        barChartHeight = Math.max(150, vizHeight - barChartMargin.top - barChartMargin.bottom);
        pairBarChartWidth = Math.max(200, currentWidth - pairBarChartMargin.left - pairBarChartMargin.right);
        pairBarChartHeight = Math.max(150, vizHeight - pairBarChartMargin.top - pairBarChartMargin.bottom);
        networkWidth = currentWidth;
        networkHeight = vizHeight;

        // Manage visibility for each group
        // **REMOVED** direct g.attr("transform") here. Zoom handler controls it.
        g.style("display", currentChartType === 'heb' ? "block" : "none");

        barG.attr("transform", `translate(${barChartMargin.left},${barChartMargin.top})`)
            .style("display", currentChartType === 'bar' ? "block" : "none");

        pairBarG.attr("transform", `translate(${pairBarChartMargin.left},${pairBarChartMargin.top})`)
               .style("display", currentChartType === 'pairs-bar' ? "block" : "none");

        netG.attr("transform", null) // Network often uses origin 0,0 or specific centering
            .style("display", currentChartType === 'network' ? "block" : "none");

        // Update network simulation center if it exists
        if (forceSimulation) {
            forceSimulation.force("center", d3.forceCenter(networkWidth / 2, networkHeight / 2));
            // forceSimulation.alpha(0.1).restart(); // Optional: reheat simulation slightly
        }

        // If HEB is the current chart, ensure its zoom transform is updated
        // This handles resize cases where the center point changes
        if (currentChartType === 'heb') {
            // Get the current zoom state
            const currentTransform = d3.zoomTransform(svg.node());
            // Calculate the new desired center based on the *current scale*
            const newTranslateX = currentWidth / 2;
            const newTranslateY = vizHeight / 2 + hebVerticalOffset;
            // Create a new transform maintaining the current scale but updating the center
            // (This is a simple recentering; more complex logic might be needed
            // if you want to keep a specific point fixed during resize)
             const recenteredTransform = d3.zoomIdentity
                 .translate(newTranslateX, newTranslateY)
                 .scale(currentTransform.k); // Keep current scale

            // Apply the recentered transform immediately (no transition needed on resize)
            svg.call(zoom.transform, recenteredTransform);
             // Alternatively, if you want to fully reset on resize:
             // svg.call(zoom.transform, getInitialHebTransform());
        }
    }

    // Fetches data for the selected cuisine
    async function loadData(cuisineName) {
        if (!cuisineName) {
            clearVisualization("Select a cuisine from the list.");
            updateTitle("Ingredient Relationships");
            currentCuisineData = null;
            return;
        }

        setLoadingState(true, cuisineName); // Show loading indicator
        currentCuisineData = null; // Clear previous data
        if (forceSimulation) { forceSimulation.stop(); forceSimulation = null; } // Stop network sim
        clearHighlight(); // Clear search

        try {
            const response = await fetch(`/api/heb/${cuisineName}`); // Fetch data from API
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            // Validate data structure needed for ALL charts
            if (!data || !data.hierarchy || !data.hierarchy.children || !data.links) {
                console.error("Incomplete data received:", data);
                throw new Error(`Incomplete data for ${cuisineName}. Requires hierarchy with children and links.`);
            }

            currentCuisineData = data; // Store raw data
            updateTitle(`${cuisineName} - Ingredient Analysis`);
            renderCurrentChart(); // Render the active chart type

        } catch (error) {
            console.error(`Error loading data for ${cuisineName}:`, error);
            displayErrorMessage(`Failed to load data for ${cuisineName}.`);
            currentCuisineData = null;
        } finally {
            setLoadingState(false); // Hide loading indicator
        }
    }

    // --- Data Processing Functions ---
    // (processDataForHEB, processDataForBarChart, processDataForNetwork, processDataForPairsBarChart - unchanged)
    // Processes data for HEB (Filters based on link strength & node degree)
    function processDataForHEB(rawData) {
        console.log("Processing data for HEB...");
        if (!rawData?.links || !rawData?.hierarchy) return null; // Basic check

        const filteredLinks = rawData.links.filter(link => link.value > 2);
        if (filteredLinks.length === 0) return { error: "No strong ingredient connections (value > 2)." };

        const nodeDegrees = {};
        const nodesInFilteredLinks = new Set();
        filteredLinks.forEach(link => {
            nodeDegrees[link.source] = (nodeDegrees[link.source] || 0) + 1;
            nodeDegrees[link.target] = (nodeDegrees[link.target] || 0) + 1;
            nodesInFilteredLinks.add(link.source);
            nodesInFilteredLinks.add(link.target);
        });

        const filteredHierarchy = filterHierarchy(rawData.hierarchy, node => {
            // Keep leaf node only if its degree > 1 (based on strong links)
            if (!node.children) return nodesInFilteredLinks.has(node.name) && nodeDegrees[node.name] > 1;
            return true; // Keep internal nodes initially
        });

        if (!filteredHierarchy?.children?.length) return { error: "No significant ingredient clusters found after filtering." };

        const survivingLeafNodeNames = new Set();
        function collectLeafNames(node) {
            if (!node.children && node.name) survivingLeafNodeNames.add(node.name);
            if (node.children) node.children.forEach(collectLeafNames);
        }
        collectLeafNames(filteredHierarchy);

        const finalLinks = filteredLinks.filter(link =>
            survivingLeafNodeNames.has(link.source) && survivingLeafNodeNames.has(link.target)
        );

        if (finalLinks.length === 0) return { error: "No connections remain between filtered ingredients." };

        const root = d3.hierarchy(filteredHierarchy).sum(d => d.value || 1).sort((a, b) => d3.ascending(a.data.name, b.data.name));
        const cluster = d3.cluster()
        .size([360, radius * 0.85]) // Use 85% of available radius
        (root);
        const nodeMap = new Map(root.leaves().map(d => [d.data.name, d])); // Map names to D3 nodes

        console.log(`HEB Processed: ${nodeMap.size} nodes, ${finalLinks.length} links.`);
        return { root, finalLinks, nodeMap };
    }

    // Processes data for Top Ingredients Bar Chart (Occurrences)
    function processDataForBarChart(rawData, topN = 20) {
        console.log("Processing data for Top Ingredients Bar Chart...");
        if (!rawData?.hierarchy?.children) return null;

        const ingredients = rawData.hierarchy.children;
        const validIngredients = ingredients
            .filter(item => item?.name && typeof item.value === 'number' && item.value >= 0)
            .map(item => ({ name: item.name, value: item.value }));

        if (validIngredients.length === 0) return { error: "No valid ingredient occurrence data found." };

        const sortedNodes = validIngredients.sort((a, b) => b.value - a.value).slice(0, topN);

        if (sortedNodes.length === 0) return { error: "No ingredients after sorting/filtering." };

        console.log(`Top Ingredients Bar Processed: ${sortedNodes.length} nodes.`);
        return { sortedNodes };
    }

    // Processes data for Network Graph
    function processDataForNetwork(rawData) {
        console.log("Processing data for Network Graph...");
        if (!rawData?.links || !rawData?.hierarchy) return null;

        const nodeSet = new Set();
        rawData.links.forEach(link => { nodeSet.add(link.source); nodeSet.add(link.target); });
        const nodes = Array.from(nodeSet).map(name => ({ id: name })); // Nodes need 'id'

        // Map links to use 'id' if needed by forceLink, ensure value exists
        const links = rawData.links.map(link => ({
            source: link.source, target: link.target, value: link.value || 1
        }));

        if (nodes.length === 0) return { error: "No nodes found for network." };
        console.log(`Network Processed: ${nodes.length} nodes, ${links.length} links.`);
        return { nodes, links };
    }

    // Processes data for Top Pairs Bar Chart
     function processDataForPairsBarChart(rawData, topN = 20) {
        console.log("Processing data for Top Pairs Bar Chart...");
        if (!rawData?.links) return null;

        if (rawData.links.length === 0) return { error: "No links (pairs) available." };

        const sortedLinks = [...rawData.links]
             .filter(link => link.value > 0)
            .sort((a, b) => b.value - a.value) // Sort descending by co-occurrence value
            .slice(0, topN);

        const chartData = sortedLinks.map(link => ({
            pairLabel: [link.source, link.target].sort().join(' & '), // Consistent label
            value: link.value,
            source: link.source, // Keep original for potential interaction
            target: link.target
        }));

         if (chartData.length === 0) return { error: "No pairs found after sorting/filtering." };

        console.log(`Top Pairs Bar Processed: ${chartData.length} pairs.`);
        return { sortedPairs: chartData };
    }


    // --- Chart Rendering Functions ---

    // Dispatcher: decides which chart to render based on state
    function renderCurrentChart() {
        console.log(`renderCurrentChart called. Type: ${currentChartType}, Data loaded: ${!!currentCuisineData}`);
        if (!currentCuisineData) {
            const selectValue = document.getElementById("cuisine-select")?.value;
            clearVisualization(selectValue ? "" : "Select a cuisine to begin.");
             if (selectValue) console.warn("renderCurrentChart: No data available.");
            updateSvgDimensions(); // Ensure correct groups hidden/shown
            return;
        }

        // Clear previous drawings & ensure correct layout/visibility for the target chart
        clearVisualization();
        updateSvgDimensions(); // Call this BEFORE processing/rendering

        try {
            let processed = null;
            let renderFunction = null;
            let requiredDataCheck = () => true; // Default check

            // Configure based on chart type
            switch (currentChartType) {
                case 'heb':
                    requiredDataCheck = () => !!currentCuisineData.links && !!currentCuisineData.hierarchy;
                    if (!requiredDataCheck()) { displayErrorMessage("Links & hierarchy needed for HEB."); return; }
                    processed = processDataForHEB(currentCuisineData);
                    renderFunction = renderHEB;
                    break;
                case 'bar':
                    requiredDataCheck = () => !!currentCuisineData.hierarchy?.children;
                    if (!requiredDataCheck()) { displayErrorMessage("Ingredient data needed for Top Ingredients chart."); return; }
                    processed = processDataForBarChart(currentCuisineData);
                    renderFunction = renderBarChart;
                    break;
                case 'network':
                     requiredDataCheck = () => !!currentCuisineData.links && !!currentCuisineData.hierarchy;
                     if (!requiredDataCheck()) { displayErrorMessage("Links & hierarchy needed for Network."); return; }
                    processed = processDataForNetwork(currentCuisineData);
                    renderFunction = renderNetwork;
                    break;
                case 'pairs-bar':
                    requiredDataCheck = () => !!currentCuisineData.links;
                     if (!requiredDataCheck()) { displayErrorMessage("Links data needed for Top Pairs chart."); return; }
                    processed = processDataForPairsBarChart(currentCuisineData);
                    renderFunction = renderPairsBarChart;
                    break;
                default:
                    console.error(`Unknown chart type: ${currentChartType}`);
                    displayErrorMessage(`Unknown chart type selected.`);
                    return;
            }

            // Render or show message
            if (processed?.error) {
                displayInfoMessage(processed.error);
            } else if (processed && renderFunction) {
                renderFunction(processed); // Call the specific render function
                 // Apply search highlight if search term exists AFTER rendering
                 const currentSearchTerm = searchInput.node().value;
                 if (currentSearchTerm) {
                     highlightNodes(currentSearchTerm);
                 }
            } else {
                // This case handles if processing returns null (e.g., invalid input data)
                displayErrorMessage(`Could not process data for ${currentChartType} chart.`);
            }

        } catch (error) {
            console.error(`Error rendering ${currentChartType} chart:`, error);
            displayErrorMessage(`An error occurred drawing the chart.`);
        }
    }

    // Renders HEB Chart
    function renderHEB({ root, finalLinks, nodeMap }) {
        console.log("Rendering HEB chart...");

        // Calculate dynamic text scaling
        const textScale = Math.min(1.2, Math.max(0.8, currentWidth / 1000));

        // Clear previous elements and show message if no data
        g.selectAll("*").remove();
        if (!root || !finalLinks || !nodeMap || nodeMap.size === 0) {
            displayInfoMessage("Not enough data for HEB view after filtering.");
            return;
        }

        // Filter links and warn if any were dropped
        let linksToDraw = finalLinks.filter(link => nodeMap.has(link.source) && nodeMap.has(link.target));
        if (linksToDraw.length !== finalLinks.length) {
            console.warn("Some HEB links dropped due to missing nodes in map.");
        }

        // **REMOVED** direct transform setting: g.attr("transform", ...);

        // Draw Links
        const linkSelection = g.selectAll(".link")
            .data(linksToDraw).enter().append("path")
            .attr("class", "link")
            .attr("d", d => lineRadial([nodeMap.get(d.source), nodeMap.get(d.target)]))
            .style("stroke", (d, i) => lineColors[i % lineColors.length])
            .style("fill", "none")
            .style("stroke-width", d => Math.min(8, Math.max(1, Math.sqrt(d.value))))
            .style("stroke-opacity", 0.6)
            .style("pointer-events", "visibleStroke"); // Make links interactive

        // Draw Nodes
        const nodeSelection = g.selectAll(".node")
            .data(root.leaves()).enter().append("g")
            .attr("class", "node")
            .attr("transform", d => `rotate(${d.x - 90}) translate(${d.y},0)`)
            .style("cursor", "pointer"); // Use pointer cursor for hover/click indication

        // Add node circles
        nodeSelection.append("circle")
            .attr("r", 5)
            .style("fill", d => colorScale(d.parent.data.name))
            .style("stroke", "#333")
            .style("stroke-width", 1);

        // Add node labels with dynamic sizing
        nodeSelection.append("text")
            .attr("dy", `${3 * textScale}px`)
            .attr("x", d => d.x < 180 ? 8 : -8)
            .style("text-anchor", d => d.x < 180 ? "start" : "end")
            .attr("transform", d => d.x < 180 ? null : "rotate(180)")
            .style("font-size", `${10 * textScale}px`)
            .style("text-shadow", "1px 1px 2px white")
            .text(d => d.data.name);

        // Setup interactivity (hover effects)
        setupHEBInteractivity(linkSelection, nodeSelection);

        // --- IMPORTANT: Set the INITIAL view using zoom.transform ---
        // Apply the initial transform state WITHOUT transition when rendering
        // Do this *after* elements are added to 'g' but before returning.
        svg.call(zoom.transform, getInitialHebTransform());

        // Make sure zoom is enabled for this chart (it's attached to SVG globally)
        // svg.call(zoom).on("dblclick.zoom", null); // Already done globally

        // --- Node Dragging (Example - basic implementation) ---
        // This drag might interfere with zoom/pan unless modifier keys are used.
        // Consider if this is truly needed alongside pan/zoom.
        /*
        nodeSelection.call(d3.drag()
            .subject(function(event, d) { // Important: define drag subject relative to container
                // Transform screen coords to SVG coords, then invert the node's static transform
                const [svgX, svgY] = d3.pointer(event, svg.node());
                const rotated = (d.x - 90) * Math.PI / 180;
                const currentX = d.y * Math.cos(rotated);
                const currentY = d.y * Math.sin(rotated);
                return { x: currentX, y: currentY }; // Return position relative to the group's origin (center)
            })
            .on("start", function(event) {
                 event.sourceEvent.stopPropagation(); // Prevent zoom from starting
                 d3.select(this).raise().classed("dragging", true);
            })
            .on("drag", function(event, d) {
                // This naive drag won't preserve the radial layout well
                // It just moves the group based on mouse position
                // A proper radial drag is more complex involving angle/radius updates
                const [newX, newY] = [event.x, event.y]; // These are relative to group origin from subject
                const newAngle = (Math.atan2(newY, newX) * 180 / Math.PI) + 90; // Adjust back to D3 angle
                const newRadius = Math.sqrt(newX * newX + newY * newY);

                d.x = newAngle < 0 ? newAngle + 360 : newAngle; // Update data angle
                d.y = newRadius; // Update data radius

                d3.select(this).attr("transform", `rotate(${d.x - 90}) translate(${d.y},0)`);

                // Need to redraw connected links if nodes move relative to each other
                // This gets complex quickly!
                // updateLinksConnectedTo(d);
            })
            .on("end", function() {
                 d3.select(this).classed("dragging", false);
            }));
        */

        console.log("HEB chart rendered with initial view set via zoom.");
    }


    // Renders Top Ingredients (Occurrence) Bar Chart
    function renderBarChart({ sortedNodes }) {
        console.log("Rendering Top Ingredients Bar chart...");
        barG.selectAll("*").remove(); // Clear only Bar group

        if (!sortedNodes?.length) { displayInfoMessage("No ingredient data."); return; }

        // Scales (Keep as is)
        const maxValue = d3.max(sortedNodes, d => d.value);
        const xScale = d3.scaleLinear().domain([0, maxValue > 0 ? maxValue : 1]).range([0, barChartWidth]).nice();
        const yScale = d3.scaleBand().domain(sortedNodes.map(d => d.name)).range([0, barChartHeight]).padding(0.15);

        // Axes (Keep as is)
        const xAxis = d3.axisBottom(xScale).ticks(Math.min(10, barChartWidth / 60)).tickFormat(d3.format(maxValue >= 1000 ? "~s" : ",.0f"));
        const yAxis = d3.axisLeft(yScale);

        // Draw Axes (Keep as is)
        barG.append("g").attr("class", "x axis").attr("transform", `translate(0,${barChartHeight})`).call(xAxis)
            .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-65)");
        barG.append("g").attr("class", "y axis").call(yAxis)
        .selectAll("text")
        .style("font-size", "15px"); // Add this line

        // --- Axis Labels (USING POSITIONING FROM PAIRS CHART) ---
        // X Axis Label
        barG.append("text").attr("class", "axis-label x-axis-title")
            .attr("text-anchor", "middle")
            .attr("x", barChartWidth / 2)
            .attr("y", barChartHeight + barChartMargin.bottom * 0.7) // Adjusted Y slightly
            .text("Number of Occurrences")
            .style("font-size", "14px");

        // Y Axis Label
        barG.append("text").attr("class", "axis-label y-axis-title")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${-barChartMargin.left / 1.4}, ${barChartHeight / 2}) rotate(-90)`) // Adjusted X slightly
            .text("Ingredient")
            .style("font-size", "14px");

        // Draw Bars (Keep as is)
        const barColorInterpolator = d3.interpolateBlues;
        const bars = barG.selectAll(".bar").data(sortedNodes).enter().append("rect").attr("class", "bar")
            .attr("y", d => yScale(d.name)).attr("height", yScale.bandwidth()).attr("x", 0)
            .attr("fill", (d, i) => barColorInterpolator(0.8 - (i / (sortedNodes.length * 1.5))))
            .attr("width", 0);
        bars.transition().duration(750).delay((d, i) => i * 25).attr("width", d => Math.max(0, xScale(d.value)));
        bars.append("title").text(d => `${d.name}: ${d.value.toLocaleString()} occurrences`);

        console.log("Top Ingredients Bar chart rendered.");
    }


    // Renders Network Graph with STRONGER repulsion and collision
    function renderNetwork({ nodes, links }) {
        console.log("Rendering Network Graph (Attempting stronger separation)...");
        netG.selectAll("*").remove();

        if (!nodes?.length) { displayInfoMessage("No ingredient nodes for network."); return; }

        const link = netG.append("g").attr("class", "network-links")
            .selectAll("line").data(links).join("line")
            .attr("class", "network-link")
            .attr("stroke-width", d => Math.max(1, Math.sqrt(d.value || 1) / 2));

        const nodeRadius = 8;
        const node = netG.append("g").attr("class", "network-nodes")
            .selectAll("g").data(nodes).join("g")
            .attr("class", "network-node").style("cursor", "grab");

        node.append("circle").attr("r", nodeRadius)
            .attr("fill", (d, i) => colorScale(i % 10));
        node.append("text").text(d => d.id).attr("x", nodeRadius + 3).attr("y", 3);
        node.append("title").text(d => d.id);

        // --- Force Simulation Setup ---
        if (forceSimulation) forceSimulation.stop();

        forceSimulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links)
                .id(d => d.id)
                .distance(60)
                .strength(0.5)
            )
            .force("charge", d3.forceManyBody()
                .strength(-400)
                .distanceMax(networkWidth / 2)
            )
            .force("collide", d3.forceCollide()
                .radius(nodeRadius + 3)
                .strength(0.9)
            )
            .force("center", d3.forceCenter(networkWidth / 2, networkHeight / 2))
            .on("tick", ticked);

        node.call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

        // --- Simulation Tick/Drag Functions ---
        function ticked() {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${
                Math.max(nodeRadius, Math.min(networkWidth - nodeRadius, d.x)) // Keep X within bounds
            }, ${
                Math.max(nodeRadius, Math.min(networkHeight - nodeRadius, d.y)) // Keep Y within bounds
            })`);
        }
        function dragstarted(event, d) { if (!event.active) forceSimulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; d3.select(this).raise().style("cursor", "grabbing"); }
        function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
        function dragended(event, d) { if (!event.active) forceSimulation.alphaTarget(0); d.fx = null; d.fy = null; d3.select(this).style("cursor", "grab"); }

        console.log("Network Graph Rendered with stronger separation forces.");
    }


    // Renders Top Pairs Bar Chart
     function renderPairsBarChart({ sortedPairs }) {
        console.log("Rendering Top Pairs Bar chart...");
        pairBarG.selectAll("*").remove(); // Clear only Pair group

        if (!sortedPairs?.length) { displayInfoMessage("No pair data."); return; }

        // Scales
        const maxValue = d3.max(sortedPairs, d => d.value);
        const xScale = d3.scaleLinear().domain([0, maxValue > 0 ? maxValue : 1]).range([0, pairBarChartWidth]).nice();
        const yScale = d3.scaleBand().domain(sortedPairs.map(d => d.pairLabel)).range([0, pairBarChartHeight]).padding(0.15);

        // Axes
        const xAxis = d3.axisBottom(xScale).ticks(Math.min(8, pairBarChartWidth / 70)).tickFormat(d3.format(maxValue >= 1000 ? "~s" : ",.0f"));
        const yAxis = d3.axisLeft(yScale);

        // Draw Axes
        pairBarG.append("g").attr("class", "x axis").attr("transform", `translate(0,${pairBarChartHeight})`).call(xAxis)
            .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-45)");
        pairBarG.append("g").attr("class", "y axis").call(yAxis)
        .selectAll("text")
        .style("font-size", "15px");

        // Axis Labels
        pairBarG.append("text").attr("class", "axis-label x-axis-title").attr("text-anchor", "middle").attr("x", pairBarChartWidth / 2).attr("y", pairBarChartHeight + pairBarChartMargin.bottom * 0.7).text("Co-occurrence Strength (Value)").style("font-size", "14px"); // Adjusted Y
        pairBarG.append("text").attr("class", "axis-label y-axis-title").attr("text-anchor", "middle").attr("transform", `translate(${-pairBarChartMargin.left / 1.4}, ${pairBarChartHeight / 2}) rotate(-90)`).text("Ingredient Pair").style("font-size", "14px"); // Adjusted X

        // Draw Bars
        const bars = pairBarG.selectAll(".bar").data(sortedPairs).enter().append("rect").attr("class", "bar")
            .attr("y", d => yScale(d.pairLabel)).attr("height", yScale.bandwidth()).attr("x", 0)
            .attr("fill", (d, i) => d3.interpolateBlues(1 - i / (sortedPairs.length * 1.5)))
            .attr("width", 0);
        bars.transition().duration(750).delay((d, i) => i * 20).attr("width", d => Math.max(0, xScale(d.value)));
        bars.append("title").text(d => `${d.pairLabel}: ${d.value.toLocaleString()}`);

        console.log("Top Pairs Bar chart rendered.");
    }


    // --- Interactivity & Highlighting ---
    // (setupHEBInteractivity, highlightNodes, clearHighlight - unchanged)
    // --- Interactivity Functions ---
    function setupHEBInteractivity(linkSelection, nodeSelection) {
        // Handles hover effects specifically for the HEB chart
        console.log("Setting up HEB Interactivity (Preserve Color)...");

        if (!linkSelection || !nodeSelection || linkSelection.empty() || nodeSelection.empty()) {
            console.warn("setupHEBInteractivity: Invalid or empty selections provided.");
            return;
        }

        // --- Link Hover ---
        linkSelection
            .on("mouseover.heb", function (event, d) {
                const sourceName = d.source;
                const targetName = d.target;

                // Dim all other links and nodes
                linkSelection.style("stroke-opacity", 0.1); // Dim links
                nodeSelection.style("opacity", 0.2);     // Dim nodes (affects circle and text)

                // Enhance the hovered link (brighter, slightly thicker)
                d3.select(this)
                    .style("stroke-opacity", 0.9) // Make it almost fully opaque
                    .style("stroke-width", dd => Math.min(10, Math.max(1.5, Math.sqrt(dd.value) * 1.5))) // Slightly thicker
                    .raise(); // Bring to front

                // Enhance connected nodes (fully opaque, maybe slightly bolder text/stroke)
                nodeSelection.filter(nd => nd.data.name === sourceName || nd.data.name === targetName)
                    .style("opacity", 1.0) // Make fully opaque
                    .select("circle")
                        .style("stroke-width", 2.0) // Slightly thicker circle stroke
                        .style("stroke", "#333"); // Ensure stroke color is visible (if needed)
                nodeSelection.filter(nd => nd.data.name === sourceName || nd.data.name === targetName)
                    .select("text")
                        .style("font-weight", "bold"); // Make text bold

            })
            .on("mouseout.heb", function () {
                // Restore default styles for ALL links and nodes in the HEB group
                linkSelection
                    .style("stroke-opacity", 0.6) // Restore original opacity
                    .style("stroke-width", dd => Math.min(8, Math.max(1, Math.sqrt(dd.value)))); // Restore original width

                nodeSelection
                    .style("opacity", 1.0) // Restore original opacity
                    .select("circle")
                        .style("stroke-width", 1) // Restore original stroke width
                        .style("stroke", "#333"); // Restore original stroke color (if changed)
                nodeSelection
                    .select("text")
                        .style("font-weight", "400"); // Restore original font weight
            });

        // --- Node Hover ---
        nodeSelection
            .on("mouseover.heb", function(event, d) {
                const nodeName = d.data.name;

                // Dim all links and nodes initially
                linkSelection.style("stroke-opacity", 0.1);
                nodeSelection.style("opacity", 0.2);

                // Enhance the hovered node itself
                const currentNode = d3.select(this);
                currentNode
                    .style("opacity", 1.0) // Fully opaque
                    .raise(); // Bring group to front
                currentNode.select("circle")
                    .style("stroke-width", 2.5) // Boldest circle stroke
                    .style("stroke", "#000"); // Black stroke for primary node
                currentNode.select("text")
                    .style("font-weight", "bold"); // Boldest text

                // Find and enhance connected links and neighbor nodes
                const connectedNodeNames = new Set();
                const connectedLinkElements = []; // Store elements directly

                linkSelection.each(function(ld) { // ld is link data {source, target, value}
                    let linkConnected = false;
                    if (ld.source === nodeName) { connectedNodeNames.add(ld.target); linkConnected = true; }
                    if (ld.target === nodeName) { connectedNodeNames.add(ld.source); linkConnected = true; }
                    if (linkConnected) connectedLinkElements.push(this); // Add the link DOM element
                });

                // Enhance connected links
                d3.selectAll(connectedLinkElements)
                    .style("stroke-opacity", 0.9) // Brighter
                    .style("stroke-width", dd => Math.min(10, Math.max(1.5, Math.sqrt(dd.value) * 1.5))) // Thicker
                    .raise();

                // Enhance neighbor nodes (slightly less than primary)
                nodeSelection.filter(nd => connectedNodeNames.has(nd.data.name))
                    .style("opacity", 1.0) // Fully opaque
                    .select("circle")
                        .style("stroke-width", 2.0) // Slightly thicker stroke
                        .style("stroke", "#333");
                nodeSelection.filter(nd => connectedNodeNames.has(nd.data.name))
                    .select("text")
                        .style("font-weight", "500"); // Semi-bold
            })
            .on("mouseout.heb", function() {
                 // Restore default styles for ALL links and nodes (same as link mouseout)
                 linkSelection
                    .style("stroke-opacity", 0.6)
                    .style("stroke-width", dd => Math.min(8, Math.max(1, Math.sqrt(dd.value))));
                 nodeSelection
                    .style("opacity", 1.0)
                    .select("circle")
                        .style("stroke-width", 1)
                        .style("stroke", "#333");
                nodeSelection
                    .select("text")
                        .style("font-weight", "400");
            });
        console.log("HEB Interactivity setup complete (Preserve Color).");
    }

    // Main highlight function called by search input
    function highlightNodes(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        console.log(`Highlighting nodes for term: "${term}" on chart: ${currentChartType}`);
        clearHighlight(false); // Clear previous highlights without clearing input box

        if (!term) return; // Stop if search is empty

        let nodesToHighlight = new Set();
        let neighborsToHighlight = new Set();
        let linksToHighlight = new Set(); // Store link DOM elements

        // --- Apply Highlighting based on Active Chart ---
        if (currentChartType === 'heb') {
            const allNodes = g.selectAll(".node"); // Select the <g class='node'> groups
            const allLinks = g.selectAll(".link"); // Select the <path class='link'> elements

            allNodes.each(function(d) { if (d.data.name?.toLowerCase().includes(term)) nodesToHighlight.add(d.data.name); });

            if (nodesToHighlight.size > 0) {
                allNodes.classed("dimmed", true);
                allLinks.classed("dimmed", true); // Dim all

                allLinks.each(function(d) { // d is link data {source, target, value}
                    let linkConnected = false;
                    if (nodesToHighlight.has(d.source)) { neighborsToHighlight.add(d.target); linkConnected = true; }
                    if (nodesToHighlight.has(d.target)) { neighborsToHighlight.add(d.source); linkConnected = true; }
                    if (linkConnected) linksToHighlight.add(this); // Add the link DOM element
                });

                nodesToHighlight.forEach(name => neighborsToHighlight.delete(name)); // Exclude self from neighbors

                // Apply classes to nodes
                allNodes.filter(d => nodesToHighlight.has(d.data.name))
                        .classed("dimmed", false).classed("highlighted", true).raise();
                allNodes.filter(d => neighborsToHighlight.has(d.data.name))
                        .classed("dimmed", false).classed("highlighted-neighbor", true);

                // Apply classes directly to the selected link elements
                d3.selectAll(Array.from(linksToHighlight))
                  .classed("dimmed", false).classed("highlighted", true).raise();
            }

        } else if (currentChartType === 'network') {
            const allNodes = netG.selectAll(".network-node"); // Select the <g class='network-node'> groups
            const allLinks = netG.selectAll(".network-link"); // Select the <line class='network-link'> elements

            allNodes.each(function(d) { if (d.id?.toLowerCase().includes(term)) nodesToHighlight.add(d.id); });

            if (nodesToHighlight.size > 0) {
                allNodes.classed("dimmed", true);
                allLinks.classed("dimmed", true);

                allLinks.each(function(d) { // d is link data {source, target, value} -> source/target might be objects or ids
                    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                    let linkConnected = false;
                    if (nodesToHighlight.has(sourceId)) { neighborsToHighlight.add(targetId); linkConnected = true; }
                    if (nodesToHighlight.has(targetId)) { neighborsToHighlight.add(sourceId); linkConnected = true; }
                    if (linkConnected) linksToHighlight.add(this);
                });

                nodesToHighlight.forEach(id => neighborsToHighlight.delete(id));

                // Apply classes to nodes
                allNodes.filter(d => nodesToHighlight.has(d.id))
                        .classed("dimmed", false).classed("highlighted", true).raise();
                allNodes.filter(d => neighborsToHighlight.has(d.id))
                        .classed("dimmed", false).classed("highlighted-neighbor", true);

                // Apply classes directly to the selected link elements
                 d3.selectAll(Array.from(linksToHighlight))
                   .classed("dimmed", false).classed("highlighted", true).raise();
            }

        } else if (currentChartType === 'bar' || currentChartType === 'pairs-bar') {
            const targetGroup = (currentChartType === 'bar') ? barG : pairBarG;
            const allBars = targetGroup.selectAll(".bar"); // Select the <rect class='bar'>
            const allYAxisTicks = targetGroup.selectAll(".y.axis .tick"); // Select the <g class='tick'>

            allBars.classed("dimmed", true);
            allYAxisTicks.classed("dimmed", true); // Dim the entire tick group first

            // Highlight matching bars
            allBars.filter(d => {
                const label = (currentChartType === 'bar') ? d.name : d.pairLabel;
                return label?.toLowerCase().includes(term);
            }).classed("dimmed", false).classed("highlighted", true);

            // Find matching ticks and apply highlight class to the TEXT inside them
            allYAxisTicks.filter(labelName => labelName?.toLowerCase().includes(term))
               .classed("dimmed", false) // Undim the tick group
               .select("text")           // Select the text within the matching tick
               .classed("highlighted", true); // Add highlight class TO THE TEXT
        }
         console.log(`Applied highlight for "${term}". Found: ${nodesToHighlight.size} primary, ${neighborsToHighlight.size} neighbors, ${linksToHighlight.size} links.`);
    }


    // Clears all highlight styles and optionally the search input
    function clearHighlight(clearInput = true) {
        console.log("Clearing highlights...");
        // Remove highlight classes from all potential elements
        svg.selectAll(".highlighted, .highlighted-neighbor, .dimmed")
           .classed("highlighted highlighted-neighbor dimmed", false);

        // Specifically ensure axis text highlighting is removed
        svg.selectAll(".y.axis .tick text.highlighted").classed("highlighted", false);
        svg.selectAll(".y.axis .tick.dimmed").classed("dimmed", false); // Undim tick groups

        if (clearInput) {
            searchInput.node().value = '';
        }
    }

    // Recursive helper for HEB filtering
    function filterHierarchy(node, condition) {
        if (!node?.children) { // Check if node exists and is a leaf
            return node && condition(node) ? { ...node } : null;
        }
        // Filter children recursively
        const filteredChildren = node.children
            .map(child => filterHierarchy(child, condition))
            .filter(child => child !== null); // Remove nulls (filtered out children)

        // Keep internal node only if it has surviving children
        if (filteredChildren.length > 0) {
            return { ...node, children: filteredChildren }; // Return copy with filtered children
        }
        return null; // Prune branch if no children survive
    }

    // --- UI Helper Functions ---
    // (updateTitle, setLoadingState, displayErrorMessage, displayInfoMessage, clearVisualization, setActiveButton - unchanged)

    function updateTitle(text) { controls.select("h1").text(text); }

    function setLoadingState(isLoading, cuisineName = '') {
        const loadingIndicator = container.select(".loading-indicator");

        if (isLoading) {
            updateTitle(`Loading ${cuisineName}...`);
            clearVisualization(); // Clear previous content before showing loading
            container.style("opacity", 0.5); // Dim container slightly

            if (loadingIndicator.empty()) {
                 container.append("div")
                    .attr("class", "loading-indicator") // Use CSS class for styling
                    .text("Loading...");
            }
            container.select(".loading-indicator").style("display", "block"); // Show it
        } else {
            container.style("opacity", 1); // Restore opacity
            container.select(".loading-indicator").remove(); // Remove when done
        }
    }

    function displayErrorMessage(message) {
        clearVisualization(); // Clear drawings first
        updateTitle("Error"); // Optional: Change main title on error

        const targetGroup = (currentChartType === 'heb') ? g :
                            (currentChartType === 'network') ? netG :
                            (currentChartType === 'bar') ? barG :
                            (currentChartType === 'pairs-bar') ? pairBarG : svg; // Fallback

        // Add message centered within the main SVG container
        // Remove any existing messages first
        container.selectAll(".error-message, .info-message").remove();
        container.append("div")
            .attr("class", "error-message") // Use CSS class for styling
            .text(message);

        // Also clear the specific chart group just in case
        targetGroup.selectAll("*").remove();
    }

     function displayInfoMessage(message) {
        clearVisualization(); // Clear drawings first

        const targetGroup = (currentChartType === 'heb') ? g :
                            (currentChartType === 'network') ? netG :
                            (currentChartType === 'bar') ? barG :
                            (currentChartType === 'pairs-bar') ? pairBarG : svg; // Fallback

        // Add message centered within the main SVG container
        container.selectAll(".error-message, .info-message").remove();
        container.append("div")
             .attr("class", "info-message") // Use CSS class for styling
             .text(message);

        // Also clear the specific chart group
        targetGroup.selectAll("*").remove();
    }


    function clearVisualization(message = "") {
        // Clear drawing content from ALL groups
        g.selectAll("*").remove();
        barG.selectAll("*").remove();
        pairBarG.selectAll("*").remove();
        netG.selectAll("*").remove();

        // Remove messages or loading indicators positioned in the container div
        container.selectAll(".loading-indicator, .error-message, .info-message").remove();

        if (message) { // Only show message if provided
             // Check if it's the initial state (no cuisine selected)
             const cuisineSelected = document.getElementById("cuisine-select")?.value;
             if (!cuisineSelected || !currentCuisineData) {
                displayInfoMessage(message); // Show initial/info message using the helper
             }
        }
    }

    function setActiveButton(activeButtonId) {
        chartButtonsContainer.selectAll("button").classed("active", false);
        chartButtonsContainer.select(`#${activeButtonId}`).classed("active", true);
    }


    // --- Event Listeners ---

    // Dropdown
    const selectElement = document.getElementById("cuisine-select");
    if (selectElement) {
        selectElement.addEventListener("change", (e) => loadData(e.target.value));
    } else { console.error("Cuisine select dropdown not found."); }

    // Chart Buttons
    chartButtonsContainer.selectAll("button").on("click", function() {
        const buttonId = d3.select(this).attr("id");
        let newChartType = '';
        switch (buttonId) {
            case 'heb-button': newChartType = 'heb'; break;
            case 'network-button': newChartType = 'network'; break;
            case 'bar-button': newChartType = 'bar'; break;
            case 'pairs-bar-button': newChartType = 'pairs-bar'; break;
            default: console.warn(`Unknown button ID clicked: ${buttonId}`); return;
        }

        if (newChartType !== currentChartType) {
            console.log(`Switching chart type to: ${newChartType}`);
            if (forceSimulation) { forceSimulation.stop(); forceSimulation = null; } // Stop sim if leaving network
            // Detach zoom handler if switching AWAY from HEB (optional, but cleaner)
            // if (currentChartType === 'heb' && newChartType !== 'heb') {
            //    svg.on('.zoom', null); // Remove all zoom listeners
            // }

            currentChartType = newChartType;
            setActiveButton(buttonId);

            // Re-attach zoom handler if switching TO HEB
            // if (currentChartType === 'heb') {
            //     svg.call(zoom).on("dblclick.zoom", null);
            // } else {
            //     // Ensure zoom is disabled for other charts if needed
            //     svg.on('.zoom', null); // Or selectively disable pan/zoom interaction
            // }

            renderCurrentChart(); // Update dimensions and render
            clearHighlight(); // Clear search on chart switch
        }
    });

    // Search Input
    searchInput.on("input", function() {
        highlightNodes(this.value);
    });

    // Clear Highlight Button
    clearHighlightButton.on("click", () => clearHighlight(true));

    // Resize Listener
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            console.log("Window resized, updating layout...");
             if (forceSimulation) forceSimulation.stop(); // Stop sim during resize
            updateSvgDimensions(); // Update layout/sizes AND recalculate HEB center if active
            renderCurrentChart(); // Re-render the active chart with new dimensions
        }, 250);
    });

    // --- Initial Load ---
    updateSvgDimensions(); // Set initial sizes/visibility
    clearVisualization("Select a cuisine to begin.");
    setActiveButton('heb-button'); // Set default active button

    console.log("Visualization Initialized.");

}); // End DOMContentLoaded listener