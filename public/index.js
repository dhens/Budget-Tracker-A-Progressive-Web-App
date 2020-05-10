let transactions = [];
let myChart;
let db;

// CREATE INDEXEDDB
const req = indexedDB.open("pendingDb", 1);

// WHEN UPDATE HAPPENS
req.onupgradeneeded = function (event) {
  // create object store called "pending" and set autoIncrement to true
  const db = event.target.result;
  db.createObjectStore("pending", { autoIncrement: true });
};

// IF REQUEST RESULTS IN SUCCESS
req.onsuccess = function (event) {
  db = event.target.result;
  //check if the browser is online, if yes post the pending data to mongoose database 
  if (navigator.onLine) {
    sendIndexedDbData();
  }
};

// IF REQUEST RESULTS IN FAILURE
req.onerror = (event) => {
  console.log("Error occured : " + event.target.errorCode);
}

// GET ALL DB DATA TO USE FOR POPULATING CHART
fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

const populateTotal = () => {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

const populateTable = () => {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";
  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;
    tbody.appendChild(tr);
  });
}

const populateChart = () => {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;
  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: "Total Over Time",
        fill: true,
        backgroundColor: "#6666ff",
        data
      }]
    }
  });
}

const sendTransaction = isAdding => {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();

  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
    .then(response => {
      //   setTimeout() 
      return response.json();
    })
    .then(data => {
      if (data.errors) {
        errorEl.textContent = "Missing Information";
      }
      else {
        // clear form
        nameEl.value = "";
        amountEl.value = "";
      }
    })
    .catch(err => {
      // fetch failed, so save in indexed db
      saveRecord(transaction);

      // clear form
      nameEl.value = "";
      amountEl.value = "";
    });
}

const sendIndexedDbData = () => {
  const transaction = db.transaction(["pending"], "readwrite");
  const store = transaction.objectStore("pending");
  const getAllPending = store.getAll();
  getAllPending.onsuccess = () => {
    if (getAllPending.result.length > 0) {
      fetch("/api/transaction/bulk", {
        method: "POST",
        body: JSON.stringify(getAllPending.result),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      })
        .then(response => {
          return response.json();
        })
        .then(() => {
          const transaction = db.transaction(["pending"], "readwrite");

          // access your pending object store
          const store = transaction.objectStore("pending");

          // clear all items in your store
          store.clear();
        });
    }
  }
}

const saveRecord = pendingData => {
  const transaction = db.transaction(["pending"], "readwrite");
  const store = transaction.objectStore("pending");
  store.add(pendingData);
}

const pushOfflineData = () => {
  sendIndexedDbData();
  location.reload();
}

document.querySelector("#add-btn").onclick = function () {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function () {
  sendTransaction(false);
};