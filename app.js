document.getElementById('fileInput').addEventListener('change', handleFileChange);
document.getElementById('columnSelect').addEventListener('change', analyzeData);
document.getElementById('barColor').addEventListener('change', analyzeData);
document.getElementById('lineColor').addEventListener('change', analyzeData);

let dataLines = [];
let chart;

function handleFileChange(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
        const data = event.target.result;
        dataLines = data.split('\n');
        const headers = dataLines[0].split(',');

        const columnSelect = document.getElementById('columnSelect');
        columnSelect.innerHTML = '';
        headers.forEach((header, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = header;
            columnSelect.appendChild(option);
        });

        analyzeData();
    };

    reader.readAsText(file);
}

function analyzeData() {
    const columnSelect = document.getElementById('columnSelect');
    const selectedColumnIndex = parseInt(columnSelect.value);
    const columnTitle = columnSelect.options[columnSelect.selectedIndex].text;
    const numbers = dataLines.slice(1).map(line => {
        const columns = line.split(',');
        return parseFloat(columns[selectedColumnIndex]);
    }).filter(num => !isNaN(num) && num > 0); // Ensure numbers are valid and positive

    if (numbers.length === 0) {
        alert('No valid numeric data found in the selected column.');
        return;
    }

    const leadingDigits = numbers.map(num => parseInt(num.toString()[0]));

    const counts = Array(10).fill(0);
    leadingDigits.forEach(digit => counts[digit]++);

    const total = leadingDigits.length;
    const frequencies = counts.map(count => count / total);

    const benfordFrequencies = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];

    // Calculate MAPE
    const mape = benfordFrequencies.slice(1).reduce((sum, expected, index) => {
        const observed = frequencies[index + 1];
        return sum + Math.abs((observed - expected) / expected);
    }, 0) / 9 * 100;

    // Chi-Square Test
    const chiSquare = benfordFrequencies.slice(1).reduce((sum, expected, index) => {
        const observed = frequencies[index + 1];
        const expectedCount = expected * total;
        const observedCount = counts[index + 1];
        return sum + Math.pow(observedCount - expectedCount, 2) / expectedCount;
    }, 0);

    // Kolmogorov-Smirnov Test
    const cumulativeObserved = frequencies.slice(1).reduce((acc, freq, index) => {
        const cumulative = index === 0 ? freq : acc[index - 1] + freq;
        return [...acc, cumulative];
    }, []);

    const cumulativeBenford = benfordFrequencies.slice(1).reduce((acc, freq, index) => {
        const cumulative = index === 0 ? freq : acc[index - 1] + freq;
        return [...acc, cumulative];
    }, []);

    const ksTest = cumulativeObserved.reduce((maxDiff, observed, index) => {
        const diff = Math.abs(observed - cumulativeBenford[index]);
        return Math.max(maxDiff, diff);
    }, 0);

    document.getElementById('mape').textContent = `${mape.toFixed(2)}%`;
    document.getElementById('chiSquare').textContent = `${chiSquare.toFixed(2)}`;
    document.getElementById('ksTest').textContent = `${ksTest.toFixed(2)}`;

    // Explanation Texts
    document.getElementById('mapeExplanation').textContent = `MAPE (Mean Absolute Percentage Error) measures the accuracy of the observed frequencies compared to the expected frequencies from Benford's Law. A lower MAPE indicates a closer fit to Benford's Law. Typically, a MAPE less than 10% suggests a strong conformity to Benford's Law.`;
    document.getElementById('chiSquareExplanation').textContent = `The Chi-Square test compares the observed frequencies with the expected frequencies from Benford's Law. A lower Chi-Square value indicates a better fit. Significant deviations from Benford's Law are indicated by higher Chi-Square values. As a rough guide, a Chi-Square value less than 15.51 (for 8 degrees of freedom at the 95% confidence level) suggests the data fits Benford's Law well.`;
    document.getElementById('ksTestExplanation').textContent = `The Kolmogorov-Smirnov (K-S) test measures the maximum difference between the cumulative distribution of the observed data and the expected cumulative distribution from Benford's Law. A lower K-S test value indicates a better fit. Generally, a K-S statistic below 0.1 suggests a strong conformity to Benford's Law.`;

    let explanation = '';
    if (mape < 10) {
        explanation = 'The observed data closely follows Benford\'s Law. This suggests that the data is naturally occurring and has not been manipulated.';
    } else if (mape < 20) {
        explanation = 'The observed data somewhat follows Benford\'s Law. There might be some deviations, but it generally aligns with expectations.';
    } else {
        explanation = 'The observed data does not follow Benford\'s Law well. This could suggest that the data might have been manipulated or does not naturally follow Benford\'s distribution.';
    }
    document.getElementById('explanationText').textContent = explanation;

    // Combined Chart
    const barColor = document.getElementById('barColor').value;
    const lineColor = document.getElementById('lineColor').value;

    if (chart) {
        chart.destroy();
    }

    const ctx = document.getElementById('chart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
            datasets: [
                {
                    label: 'Observed Frequencies',
                    data: frequencies.slice(1),
                    backgroundColor: `${barColor}80`, // Add transparency to bars
                    borderColor: barColor,
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Benford\'s Law',
                    data: benfordFrequencies.slice(1),
                    type: 'line',
                    borderColor: lineColor,
                    backgroundColor: lineColor,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return (value * 100).toFixed(0) + '%';
                        }
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const value = (context.raw * 100).toFixed(2) + '%';
                            return `${label}: ${value}`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: `Benford's Law Analysis (${total} rows of data) - Column: ${columnTitle}`
                }
            }
        }
    });

    // Data Table
    const dataTableBody = document.getElementById('dataTable').getElementsByTagName('tbody')[0];
    dataTableBody.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
        const row = dataTableBody.insertRow();
        const cellDigit = row.insertCell(0);
        const cellObserved = row.insertCell(1);
        const cellExpected = row.insertCell(2);
        const cellDifference = row.insertCell(3);

        cellDigit.textContent = i;
        cellObserved.textContent = (frequencies[i] * 100).toFixed(2) + '%';
        cellExpected.textContent = (benfordFrequencies[i] * 100).toFixed(2) + '%';
        cellDifference.textContent = ((frequencies[i] - benfordFrequencies[i]) * 100).toFixed(2) + '%';

        const diff = Math.abs(frequencies[i] - benfordFrequencies[i]);
        const colorIntensity = Math.min(diff * 5, 1);
        const color = `rgba(${frequencies[i] > benfordFrequencies[i] ? '255, 102, 102' : '102, 255, 102'}, ${colorIntensity})`;

        cellObserved.style.backgroundColor = color;
        cellDifference.style.backgroundColor = color;
    }
}
