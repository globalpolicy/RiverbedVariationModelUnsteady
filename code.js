let chart, worker;
let Z0, Q, B, n, s0, porosity, a, b, reachLength, simulationTime, delX, delT, delayMs, qsInjected;
let calculatedProfiles;

function updateGraph() {
    if (worker != undefined) {
        worker.terminate();
    }
    worker = new Worker('worker.js');


    Z0 = document.getElementById("z0").valueAsNumber;
    Q = document.getElementById("discharge").valueAsNumber;
    B = document.getElementById("width").valueAsNumber;
    n = document.getElementById("manningsn").valueAsNumber;
    s0 = document.getElementById("bedslope").valueAsNumber;
    porosity = document.getElementById("porosity").valueAsNumber;
    a = document.getElementById("a").valueAsNumber;
    b = document.getElementById("b").valueAsNumber;
    reachLength = document.getElementById("reach").valueAsNumber;
    simulationTime = document.getElementById("maxT").valueAsNumber;
    delX = document.getElementById("delX").valueAsNumber;
    delT = document.getElementById("delT").valueAsNumber;
    delayMs = document.getElementById("delayMs").valueAsNumber;
    let q0 = Q / B; let h0 = Math.pow(q0 * q0 * n * n / s0, 0.3);
    qsInjected = document.getElementById("qsInjected").valueAsNumber * a * Math.pow(q0 / h0, b);


    worker.onmessage = (event) => {
        let data = event.data;
        if (data.msgType == 'progress') {
            document.title = data.msgData;
        } else {
            profileCounter = 0;
            calculatedProfiles = data.msgData;
            let maxZ = findMaxZ(calculatedProfiles);
            setTimeout(function repeat() {
                profile = calculatedProfiles[profileCounter++];
                if (profile != null) {
                    drawChart(profile, calculatedProfiles[0], maxZ);
                    setTimeout(repeat, delayMs);
                }
            }, delayMs);
        }
    };

    worker.postMessage({
        Z0, Q, B, n, s0, porosity, a, b, reachLength, simulationTime, delX, delT, delayMs, qsInjected
    });

}

function findMaxZ(calculatedProfiles) {
    let maxZ = 0;
    for (let i = 0; i < calculatedProfiles.length; i++) {
        let profile = calculatedProfiles[i];
        for (let j = 0; j < profile.x.length; j++) {
            if (profile.z[j] > maxZ) {
                maxZ = profile.z[j];
            }
        }
    }
    return maxZ;
}

function drawChart(profile, initialProfile,maxZ) {
    let ctx = document.getElementById('chart').getContext('2d');
    if (chart != undefined) {
        chart.destroy();
    }
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: profile.x,
            datasets: [{
                label: 'Bed level z (m)',
                data: profile.z,
                borderColor: ['rgba(25, 99, 132, 1)'],
                borderWidth: 1,
                fill: false,
                pointRadius: 1
            },
            {
                label: 'Initial bed level z (m)',
                data: initialProfile.z,
                borderColor: ['rgba(255, 99, 132, 1)'],
                borderWidth: 1,
                fill: false,
                pointRadius: 1
            }/* ,
            {
                label: 'Flow depth h (m)',
                data: profile.h,
                borderColor: ['rgba(255, 99, 132, 1)'],
                borderWidth: 1,
                fill: false,
                pointRadius: 1
            },
            {
                label: 'Specific discharge q',
                data: profile.q,
                borderColor: ['rgba(255, 99, 132, 1)'],
                borderWidth: 1,
                fill: false,
                pointRadius: 1
            } */]
        },
        options: {
            animation: {
                duration: 1
            },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: false,
                        autoSkip: true,
                        min: Z0 - reachLength * s0,
                        max: maxZ
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Meters (m)'
                    }
                }],
                xAxes: [{
                    ticks: {
                        autoSkip: true,
                        min: 0,
                        max: reachLength
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'x (m)'
                    }
                }]
            },
            title: {
                display: true,
                text: profile.t + " s"
            },
            maintainAspectRatio: false,
            responsive: false
        }
    });
}
