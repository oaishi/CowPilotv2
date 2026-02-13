// Navigation scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = 'none';
    }
});

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile menu toggle
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '100%';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.background = 'white';
        navLinks.style.padding = '1rem';
        navLinks.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    });
}

// Visualization tabs
const vizTabs = document.querySelectorAll('.viz-tab');
const vizPanels = document.querySelectorAll('.viz-panel');

vizTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        
        // Remove active class from all tabs and panels
        vizTabs.forEach(t => t.classList.remove('active'));
        vizPanels.forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding panel
        tab.classList.add('active');
        document.getElementById(`${targetTab}-panel`).classList.add('active');
        
        // Initialize charts when switching to their panels
        if (targetTab === 'heatmap') {
            initHeatmapChart();
        } else if (targetTab === 'barplot') {
            initBarplotChart();
        }
    });
});

// Animated counter for stats
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = start + (end - start) * progress;
        element.textContent = current.toFixed(end % 1 !== 0 ? 1 : 0);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = end.toFixed(end % 1 !== 0 ? 1 : 0);
        }
    };
    window.requestAnimationFrame(step);
}

// Initialize stats animation when overview panel is visible
const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
};

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statValues = entry.target.querySelectorAll('.stat-value');
            statValues.forEach(stat => {
                const target = parseFloat(stat.getAttribute('data-target'));
                if (target && !stat.classList.contains('animated')) {
                    stat.classList.add('animated');
                    animateValue(stat, 0, target, 2000);
                }
            });
        }
    });
}, observerOptions);

const overviewPanel = document.getElementById('overview-panel');
if (overviewPanel) {
    statsObserver.observe(overviewPanel);
}

// Performance Chart
let performanceChart = null;

function initPerformanceChart() {
    if (performanceChart) return;
    
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5', 'Task 6', 'Task 7', 'Task 8'],
            datasets: [{
                label: 'Success Rate (%)',
                data: [85, 88, 92, 90, 94, 93, 95, 96],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Average Actions',
                data: [4.2, 3.8, 3.5, 3.6, 3.2, 3.1, 3.0, 2.9],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Performance Metrics Over Time'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 80,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Success Rate (%)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: false,
                    min: 2,
                    max: 5,
                    title: {
                        display: true,
                        text: 'Average Actions'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

// CSV Data Storage
let heatmapData = null;
let testResultsData = null;

// Parse CSV file
async function parseCSV(filePath) {
    try {
        const response = await fetch(filePath);
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
        return data;
    } catch (error) {
        console.error('Error parsing CSV:', error);
        return null;
    }
}

// Heatmap Chart - support multiple containers (main + home)
const initedHeatmapContainers = new Set();

function initHeatmapChart(containerId) {
    const id = containerId || 'heatmapContainer';
    if (initedHeatmapContainers.has(id)) return;
    
    const container = document.getElementById(id);
    if (!container) return;
    
    if (!heatmapData) {
        parseCSV('per_cluster_llava_PTS.csv').then(data => {
            if (data) {
                heatmapData = data;
                createHeatmapChart(data, id);
                initedHeatmapContainers.add(id);
            }
        });
        return;
    }
    
    createHeatmapChart(heatmapData, id);
    initedHeatmapContainers.add(id);
}

function createHeatmapChart(data, containerId) {
    const id = containerId || 'heatmapContainer';
    const container = document.getElementById(id);
    if (!container) return;
    
    // Clear previous content
    container.innerHTML = '';
    
    // Parse file names to extract test cluster and model cluster
    const testClusters = new Set();
    const modelClusters = new Set();
    const dataMap = new Map();
    
    data.forEach(row => {
        const fileName = row.file_name;
        if (!fileName || fileName === 'always-yes-baseline' || fileName === 'always-no-baseline') {
            return;
        }
        
        // Parse pattern: test_cluster_X_model_cluster_Y.jsonl
        const match = fileName.match(/test_cluster_(\d+)_model_cluster_(\w+)\.jsonl/);
        if (match) {
            const testCluster = parseInt(match[1]);
            const modelCluster = match[2];
            const pts = parseFloat(row.PTS) || 0;
            
            testClusters.add(testCluster);
            modelClusters.add(modelCluster);
            dataMap.set(`${testCluster}_${modelCluster}`, pts);
        }
    });
    
    const testClusterArray = Array.from(testClusters).sort((a, b) => a - b);
    // Order model clusters: 0, 2, 3, finetuned, raw
    const modelClusterOrder = ['0', '2', '3', 'finetuned', 'raw'];
    const modelClusterArray = modelClusterOrder.filter(c => modelClusters.has(c));
    
    // Find min and max for color scaling
    let minPTS = Infinity;
    let maxPTS = -Infinity;
    dataMap.forEach(value => {
        minPTS = Math.min(minPTS, value);
        maxPTS = Math.max(maxPTS, value);
    });
    
    // Create classic color scale (grayscale to blue)
    const colorScale = d3.scaleSequential()
        .domain([minPTS, maxPTS])
        .interpolator(d3.interpolateBlues);
    
    // Create SVG for heatmap with better sizing
    // Get container size - use actual container height for home (e.g. 420px) or default 550
    const containerRect = container.getBoundingClientRect();
    const containerPadding = 32; // Account for chart-container padding (2rem = 32px)
    const availableWidth = containerRect.width > 0 ? containerRect.width - containerPadding : 900;
    const containerHeight = container.clientHeight > 0 ? container.clientHeight : 550;
    
    // Adjust margins to ensure y-axis fits - increase left margin for longer labels
    const margin = { top: 100, right: 150, bottom: 100, left: 180 };
    const width = availableWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;
    
    // Ensure width is positive
    const finalWidth = Math.max(width, 400);
    const finalContainerWidth = finalWidth + margin.left + margin.right;
    
    const svg = d3.select(`#${id}`)
        .append('svg')
        .attr('width', finalContainerWidth)
        .attr('height', containerHeight)
        .style('background', '#ffffff')
        .style('max-width', '100%')
        .style('overflow', 'visible')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create scales with increased padding to prevent overlap
    const xScale = d3.scaleBand()
        .domain(testClusterArray.map(c => `Cluster ${c}`))
        .range([0, finalWidth])
        .padding(0.25);
    
    const yScale = d3.scaleBand()
        .domain(modelClusterArray.map(c => {
            if (c === 'finetuned') return 'Finetuned';
            if (c === 'raw') return 'Raw';
            return `Model Cluster ${c}`;
        }))
        .range([0, height])
        .padding(0.25);
    
    // Create cells
    const cells = [];
    testClusterArray.forEach(testCluster => {
        modelClusterArray.forEach(modelCluster => {
            const key = `${testCluster}_${modelCluster}`;
            const pts = dataMap.get(key) || 0;
            cells.push({
                testCluster: `Cluster ${testCluster}`,
                modelCluster: modelCluster === 'finetuned' ? 'Finetuned' : 
                              modelCluster === 'raw' ? 'Raw' : `Model Cluster ${modelCluster}`,
                pts: pts,
                rawTestCluster: testCluster,
                rawModelCluster: modelCluster
            });
        });
    });
    
    // Draw cells with hover effects
    const cellsGroup = svg.selectAll('.cell-group')
        .data(cells)
        .enter()
        .append('g')
        .attr('class', 'cell-group');
    
    cellsGroup.append('rect')
        .attr('class', 'cell')
        .attr('x', d => xScale(d.testCluster))
        .attr('y', d => yScale(d.modelCluster))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('fill', d => colorScale(d.pts))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .attr('stroke', '#333')
                .attr('stroke-width', 3);
        })
        .on('mouseout', function(event, d) {
            d3.select(this)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
        });
    
    // Add tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'heatmap-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', '#fff')
        .style('padding', '8px 12px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('pointer-events', 'none');
    
    cellsGroup.selectAll('rect')
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            tooltip.html(`${d.testCluster}<br/>${d.modelCluster}<br/><strong>PTS: ${d.pts.toFixed(4)}</strong>`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(200)
                .style('opacity', 0);
        });
    
    // Add text labels in cells (only if cell is large enough)
    // Only show text if cell is large enough to avoid overlap
    const minCellSize = Math.min(xScale.bandwidth(), yScale.bandwidth());
    if (minCellSize > 40) {
        cellsGroup.append('text')
            .attr('class', 'cell-label')
            .attr('x', d => xScale(d.testCluster) + xScale.bandwidth() / 2)
            .attr('y', d => yScale(d.modelCluster) + yScale.bandwidth() / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', Math.min(12, minCellSize / 4) + 'px')
            .attr('font-weight', '500')
            .attr('fill', d => {
                // Use white text for darker cells, black for lighter cells
                const threshold = (minPTS + maxPTS) / 2;
                return d.pts < threshold ? '#fff' : '#000';
            })
            .text(d => d.pts > 0 ? d.pts.toFixed(3) : '0');
    }
    
    // Add axes with better styling and spacing
    const xAxis = svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .style('font-size', '12px')
        .style('font-weight', '500');
    
    // Rotate x-axis labels to prevent overlap
    xAxis.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');
    
    const yAxis = svg.append('g')
        .call(d3.axisLeft(yScale))
        .style('font-size', '12px')
        .style('font-weight', '500');
    
    // Ensure y-axis ticks don't extend beyond bounds
    yAxis.selectAll('.tick text')
        .style('text-anchor', 'end')
        .attr('dx', '-0.5em');
    
    // Add axis labels with better styling and spacing
    svg.append('text')
        .attr('transform', `translate(${finalWidth / 2}, ${height + margin.bottom - 10})`)
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', '#333')
        .text('Test Cluster');
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 50)
        .attr('x', -height / 2)
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', '#333')
        .text('Model Cluster');
    
    // Add title
    svg.append('text')
        .attr('x', finalWidth / 2)
        .attr('y', -margin.top / 2)
        .style('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-weight', 'bold')
        .style('fill', '#1f2937')
        .text('Per Cluster PTS Heatmap');
    
    // Add color legend with better styling and spacing
    const legendWidth = 25;
    const legendHeight = 250;
    const legend = svg.append('g')
        .attr('transform', `translate(${finalWidth + 40}, 0)`);
    
    const legendScale = d3.scaleLinear()
        .domain([minPTS, maxPTS])
        .range([legendHeight, 0]);
    
    const legendAxis = d3.axisRight(legendScale)
        .ticks(6)
        .tickFormat(d3.format('.3f'));
    
    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
        .attr('id', `legend-gradient-${id.replace(/[^a-z0-9]/gi, '_')}`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');
    
    const numStops = 20;
    for (let i = 0; i <= numStops; i++) {
        const offset = i / numStops;
        linearGradient.append('stop')
            .attr('offset', `${offset * 100}%`)
            .attr('stop-color', colorScale(minPTS + (maxPTS - minPTS) * offset));
    }
    
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', `url(#legend-gradient-${id.replace(/[^a-z0-9]/gi, '_')})`)
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1)
        .attr('rx', 2);
    
    legend.append('g')
        .attr('transform', `translate(${legendWidth}, 0)`)
        .call(legendAxis)
        .style('font-size', '11px');
    
    legend.append('text')
        .attr('transform', `translate(${legendWidth / 2}, ${legendHeight + 25})`)
        .style('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .style('fill', '#333')
        .text('PTS Score');
}

// Bar Plot Chart - support multiple canvases (main + home)
const barplotCharts = {};
const initedBarplotCanvases = new Set();

function initBarplotChart(canvasId) {
    const id = canvasId || 'barplotChart';
    if (initedBarplotCanvases.has(id)) return;
    
    const ctx = document.getElementById(id);
    if (!ctx) return;
    
    if (!testResultsData) {
        parseCSV('test_results.csv').then(data => {
            if (data) {
                testResultsData = data;
                createBarplotChart(data, id);
                initedBarplotCanvases.add(id);
            }
        });
        return;
    }
    
    createBarplotChart(testResultsData, id);
    initedBarplotCanvases.add(id);
}

function createBarplotChart(data, canvasId) {
    const id = canvasId || 'barplotChart';
    const ctx = document.getElementById(id);
    if (!ctx) return;
    
    if (barplotCharts[id]) {
        barplotCharts[id].destroy();
        barplotCharts[id] = null;
    }
    
    // Define model families with classic color palette
    const modelFamilies = {
        'Claude': '#4a5568',      // Dark gray
        'Gemini': '#718096',      // Medium gray
        'GPT': '#2d3748',         // Very dark gray
        'Gemma': '#a0aec0',       // Light gray
        'Llava': '#4a5568',       // Dark gray
        'Finetuned': '#2c5282',   // Classic blue
        'Baseline': '#cbd5e0'     // Very light gray
    };
    
    // Function to determine model family
    function getModelFamily(fileName) {
        const name = fileName.toLowerCase();
        if (name.includes('claude')) return 'Claude';
        if (name.includes('gemini')) return 'Gemini';
        if (name.includes('gpt')) return 'GPT';
        if (name.includes('finetuned_gemma') || name.includes('finetuned_llava')) return 'Finetuned';
        if (name.includes('gemma')) return 'Gemma';
        if (name.includes('llava')) return 'Llava';
        if (name.includes('baseline')) return 'Baseline';
        return 'Other';
    }
    
    // Process data and assign colors
    const processedData = data.map(row => {
        const fileName = row.file_name;
        const family = getModelFamily(fileName);
        const color = modelFamilies[family] || '#9ca3af';
        
        return {
            name: fileName.replace('.jsonl', '').replace(/_/g, ' '),
            family: family,
            color: color,
            pts: parseFloat(row.PTS) || 0,
            accuracy: parseFloat(row.accuracy) || 0
        };
    });
    
    const labels = processedData.map(d => d.name);
    const ptsValues = processedData.map(d => d.pts);
    const accuracyValues = processedData.map(d => d.accuracy);
    const ptsColors = processedData.map(d => d.color + 'DD');
    const accuracyColors = processedData.map(d => d.color + '88');
    
    barplotCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'PTS',
                data: ptsValues,
                backgroundColor: ptsColors,
                borderColor: processedData.map(d => d.color),
                borderWidth: 2,
                yAxisID: 'y'
            }, {
                label: 'Accuracy',
                data: accuracyValues,
                backgroundColor: accuracyColors,
                borderColor: processedData.map(d => d.color),
                borderWidth: 2,
                borderDash: [5, 5],
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Test Results - PTS and Accuracy (Grouped by Model Family)',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        bottom: 20
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const family = processedData[context.dataIndex].family;
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ` (${family}): `;
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(4);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: false,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        }
                    },
                    title: {
                        display: true,
                        text: 'Model',
                        font: {
                            size: 13,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'PTS Score',
                        font: {
                            size: 13,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    max: 1.0,
                    title: {
                        display: true,
                        text: 'Accuracy',
                        font: {
                            size: 13,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

// Task Distribution Chart
let taskDistributionChart = null;

function initTaskDistributionChart() {
    if (taskDistributionChart) return;
    
    const ctx = document.getElementById('taskDistributionChart');
    if (!ctx) return;
    
    taskDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['E-commerce', 'Search', 'Forms', 'Navigation', 'Data Entry', 'Other'],
            datasets: [{
                data: [35, 20, 15, 12, 10, 8],
                backgroundColor: [
                    '#6366f1',
                    '#8b5cf6',
                    '#ec4899',
                    '#f59e0b',
                    '#10b981',
                    '#6b7280'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'Task Type Distribution'
                }
            }
        }
    });
}

// Initialize charts when page loads if their panels are active
document.addEventListener('DOMContentLoaded', () => {
    const activePanel = document.querySelector('.viz-panel.active');
    if (activePanel) {
        if (activePanel.id === 'heatmap-panel') {
            initHeatmapChart('heatmapContainer');
        } else if (activePanel.id === 'barplot-panel') {
            initBarplotChart('barplotChart');
        }
    }
});

// Placeholder links - Update these with actual URLs
document.addEventListener('DOMContentLoaded', () => {
    // You can update these with actual links
    const paperLink = document.getElementById('paper-link');
    const datasetLink = document.getElementById('dataset-link');
    const huggingfaceLink = document.getElementById('huggingface-link');
    const arxivLink = document.getElementById('arxiv-link');
    const datasetLinkHeader = document.getElementById('dataset-link-header');
    const footerPaperLink = document.getElementById('footer-paper-link');
    const footerDatasetLink = document.getElementById('footer-dataset-link');
    const footerHfLink = document.getElementById('footer-hf-link');
    
    // Set placeholder hrefs - replace with actual URLs
    const links = [
        paperLink, datasetLink, huggingfaceLink,
        arxivLink, datasetLinkHeader,
        footerPaperLink, footerDatasetLink, footerHfLink
    ];
    
    // For now, they point to # - update with actual URLs
    links.forEach(link => {
        if (link) {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('href') === '#') {
                    e.preventDefault();
                    alert('Please update the link URLs in script.js with your actual paper, dataset, and HuggingFace model URLs.');
                }
            });
        }
    });
});

// Add intersection observer for fade-in animations
const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, {
    threshold: 0.1
});

// Apply fade-in to sections
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fadeInObserver.observe(section);
});

