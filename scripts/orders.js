let sortOrder = {
    date: true, // true = ascending, false = descending
    price: true
};

function sortTable(colIndex, type) {
    let table = document.getElementById("ordersTable");
    let rows = Array.from(table.rows);
    
    rows.sort((rowA, rowB) => {
        let valA = rowA.cells[colIndex].innerText.trim();
        let valB = rowB.cells[colIndex].innerText.trim();
        
        if (type === "date") {
            let dateA = new Date(valA); 
            let dateB = new Date(valB);
            return sortOrder.date ? dateA - dateB : dateB - dateA;
        } 
        
        if (type === "price") {
            let numA = parseInt(valA.replace("EGP", ""));
            let numB = parseInt(valB.replace("EGP", ""));
            return sortOrder.price ? numA - numB : numB - numA;
        }
    });

    // Toggle sort order for next click
    sortOrder[type] = !sortOrder[type];

    // Re-append rows in sorted order
    rows.forEach(row => table.appendChild(row));
}
