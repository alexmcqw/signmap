// Initialize the map centered on New York City
const map = L.map('map').setView([40.7128, -74.0060], 13);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> contributors'
}).addTo(map);

// Create marker cluster group with custom options
let markers = L.markerClusterGroup({
    maxClusterRadius: 50, // Smaller clusters
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
});
map.addLayer(markers);

// Function to load and parse CSV
async function loadCSV() {
    console.log('Starting CSV load...');
    fetch('data.csv')
        .then(response => {
            console.log('CSV fetch response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(csvText => {
            console.log('CSV text loaded, first 500 chars:', csvText.substring(0, 500));
            const rows = Papa.parse(csvText, { header: true }).data;
            console.log('CSV parsed, number of rows:', rows.length);
            console.log('CSV headers:', Object.keys(rows[0]));
            
            // Log first few rows to check data structure
            console.log('First 3 rows:', rows.slice(0, 3));
            
            // Filter out rows with missing coordinates
            const validRows = rows.filter(row => {
                const hasCoords = row.latitude && row.longitude;
                if (!hasCoords) {
                    console.log('Row missing coordinates:', row);
                }
                return hasCoords;
            });
            console.log('Rows with valid coordinates:', validRows.length);
            
            createMarkers(validRows);
        })
        .catch(error => {
            console.error('Error loading CSV:', error);
        });
}

// Function to create markers from data
function createMarkers(rows) {
    console.log('Starting marker creation with', rows.length, 'rows');
    
    // Clear existing markers
    markers.clearLayers();
    
    let foodDrinkCount = 0;
    let totalMarkers = 0;
    
    rows.forEach(row => {
        try {
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);
            
            if (isNaN(lat) || isNaN(lng)) {
                console.log('Invalid coordinates for row:', row);
                return;
            }
            
            // Check if it's a food/drink location
            const isFoodDrink = row.category && (
                row.category.toLowerCase().includes('food') || 
                row.category.toLowerCase().includes('restaurant') ||
                row.category.toLowerCase().includes('cafe') ||
                row.category.toLowerCase().includes('bar')
            );
            
            if (isFoodDrink) {
                foodDrinkCount++;
            }
            
            // Choose emoji based on category
            let emoji = '📍';
            if (row['categoriesPrimary.name'] === 'Drinks') {
                emoji = '🍺';
            } else if (row['categoriesPrimary.name'] === 'Food') {
                emoji = '🍝';
            }
            const emojiIcon = L.divIcon({
                className: 'emoji-marker',
                html: emoji,
                iconSize: [48, 48],
                iconAnchor: [24, 48]
            });
            // Create marker with emoji icon
            const marker = L.marker([lat, lng], { icon: emojiIcon });
            
            // Create popup content
            let popupContent = '<div class="popup-content">';
            // Add name/title
            if (row.name || row.title) {
                popupContent += `<h3>${row.name || row.title}</h3>`;
            }
            // Add subcategory if present
            if (row['subcategoriesPrimary.name']) {
                popupContent += `<div class="subcategory">${row['subcategoriesPrimary.name']}</div>`;
            }
            // Add website if present
            if (row['urls.website']) {
                popupContent += `<div class="website"><a href="${row['urls.website']}" target="_blank">Website</a></div>`;
            }
            // Add image if present
            if (row.image) {
                popupContent += `<img src="${row.image}" alt="Image for ${row.name || row.title}" class="popup-image">`;
            }
            // Add address if available
            if (row.address) {
                popupContent += `<p class="address"><strong>Address:</strong> ${row.address}`;
                if (row.postcode) {
                    popupContent += `, ${row.postcode}`;
                }
                popupContent += '</p>';
            }
            // Add category/type if available
            if (row.category) {
                popupContent += `<p><strong>Category:</strong> ${row.category}</p>`;
            }
            // Add any other relevant fields as needed...
            popupContent += '</div>';
            
            marker.bindPopup(popupContent);
            markers.addLayer(marker);
            totalMarkers++;
            
            if (totalMarkers % 100 === 0) {
                console.log(`Created ${totalMarkers} markers so far...`);
            }
        } catch (error) {
            console.error('Error creating marker for row:', row, error);
        }
    });
    
    console.log('Marker creation complete. Total markers:', totalMarkers);
    console.log('Food/Drink locations:', foodDrinkCount);
    
    // Update stats
    document.getElementById('total-markers').textContent = totalMarkers;
    document.getElementById('food-drink-markers').textContent = foodDrinkCount;
    document.getElementById('visible-markers').textContent = totalMarkers;
}

// Function to create advanced filter controls
function createFilterControls(data) {
    const filtersDiv = document.getElementById('filters');
    filtersDiv.innerHTML = '';
    
    // Add search box
    const searchGroup = document.createElement('div');
    searchGroup.className = 'filter-group';
    searchGroup.innerHTML = `
        <label>Search</label>
        <input type="text" id="search" placeholder="Search in all fields...">
    `;
    filtersDiv.appendChild(searchGroup);
    
    // Get unique values for each column
    const columns = Object.keys(data[0] || {});
    
    // Define which columns to show as filters
    const filterableColumns = columns.filter(col => 
        col !== 'latitude' && 
        col !== 'longitude' && 
        col !== 'name' && 
        col !== 'title'
    );
    
    filterableColumns.forEach(column => {
        const uniqueValues = [...new Set(data.map(item => item[column]))]
            .filter(Boolean)
            .sort();
        
        if (uniqueValues.length > 0 && uniqueValues.length < 50) { // Only show filters with reasonable number of options
            const filterGroup = document.createElement('div');
            filterGroup.className = 'filter-group';
            
            const label = document.createElement('label');
            label.textContent = column.replace(/_/g, ' ').toUpperCase();
            
            const select = document.createElement('select');
            select.innerHTML = `
                <option value="">All ${column}</option>
                ${uniqueValues.map(value => `<option value="${value}">${value}</option>`).join('')}
            `;
            
            filterGroup.appendChild(label);
            filterGroup.appendChild(select);
            filtersDiv.appendChild(filterGroup);
        }
    });
    
    // Add event listeners for all filters
    const searchInput = document.getElementById('search');
    const filterSelects = filtersDiv.querySelectorAll('select');
    
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const filterValues = Array.from(filterSelects).map(select => ({
            column: select.previousElementSibling.textContent.toLowerCase(),
            value: select.value
        }));
        
        const filteredData = data.filter(item => {
            // Apply search filter
            if (searchTerm) {
                const itemValues = Object.values(item).join(' ').toLowerCase();
                if (!itemValues.includes(searchTerm)) {
                    return false;
                }
            }
            
            // Apply column filters
            return filterValues.every(filter => {
                if (!filter.value) return true;
                return item[filter.column] === filter.value;
            });
        });
        
        createMarkers(filteredData);
    }
    
    searchInput.addEventListener('input', applyFilters);
    filterSelects.forEach(select => select.addEventListener('change', applyFilters));
}

// Load the CSV file
document.addEventListener('DOMContentLoaded', async () => {
    const data = await loadCSV();
    createFilterControls(data);
    createMarkers(data);
}); 