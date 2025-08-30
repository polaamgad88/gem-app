// function getOrdersCountByDelegate(data, statusFilter = null) {
//   const counts = {};

//   data.forEach(order => {
//     if (statusFilter && order.status !== statusFilter) return;

//     if (!counts[order.delegate]) {
//       counts[order.delegate] = 0;
//     }
//     counts[order.delegate]++;
//   });

//   return counts;
// }


// function getTopDelegates(data, statusFilter = null) {
//   const counts = getOrdersCountByDelegate(data, statusFilter);

//   return Object.entries(counts) 
//     .sort((a, b) => b[1] - a[1]) 
//     .slice(0, 10); 
// }




function getOrdersCountByDelegate(data, statusFilter = null) {
  const counts = {};
  data.forEach(order => {
    if (statusFilter && order.status !== statusFilter) return;
    counts[order.delegate] = (counts[order.delegate] || 0) + 1;
  });
  return counts;
}

function getTopDelegates(data, statusFilter = null) {
  const counts = getOrdersCountByDelegate(data, statusFilter);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

const topDelegates = getTopDelegates(orders, "done");
const tableBody = document.getElementById("delegatesTable");
topDelegates.forEach(([delegate, count]) => {
  const row = `<tr><td>${delegate}</td><td>${count}</td></tr>`;
  tableBody.innerHTML += row;
});
