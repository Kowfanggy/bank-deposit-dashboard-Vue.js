const {
    createApp,
    ref,
    computed,
    watch,
    onMounted,
    nextTick
} = Vue;


/* =====================================================
   BANKFLOW DASHBOARD
===================================================== */

createApp({

    setup() {


        /* ================================================
           DATA
        ================================================ */

        const data = ref([]);

        const depositFilter = ref("All");

        const jobFilter = ref("All");

        const searchText = ref("");

        const currentPage = ref(1);

        const rowsPerPage = 20;


        /* ================================================
           CHART VARIABLES
        ================================================ */

        let jobChart = null;

        let depositChart = null;

        let monthChart = null;

        let scatterChart = null;


        /* ================================================
           CSV PARSER
        ================================================ */

        function parseCSV(text) {

            const rows = [];

            let row = [];

            let value = "";

            let insideQuotes = false;


            for (
                let i = 0;
                i < text.length;
                i++
            ) {

                const char = text[i];

                const nextChar = text[i + 1];


                if (
                    char === '"' &&
                    insideQuotes &&
                    nextChar === '"'
                ) {

                    value += '"';

                    i++;

                    continue;

                }


                if (char === '"') {

                    insideQuotes =
                        !insideQuotes;

                    continue;

                }


                if (
                    char === "," &&
                    !insideQuotes
                ) {

                    row.push(value.trim());

                    value = "";

                    continue;

                }


                if (
                    (
                        char === "\n" ||
                        char === "\r"
                    ) &&
                    !insideQuotes
                ) {

                    if (
                        char === "\r" &&
                        nextChar === "\n"
                    ) {

                        i++;

                    }


                    row.push(value.trim());


                    if (
                        row.some(
                            cell => cell !== ""
                        )
                    ) {

                        rows.push(row);

                    }


                    row = [];

                    value = "";

                    continue;

                }


                value += char;

            }


            if (
                value !== "" ||
                row.length > 0
            ) {

                row.push(value.trim());


                if (
                    row.some(
                        cell => cell !== ""
                    )
                ) {

                    rows.push(row);

                }

            }


            if (!rows.length) {

                return [];

            }


            const headers = rows[0];


            return rows.slice(1).map(row => {

                const obj = {};


                headers.forEach(
                    (header, index) => {

                        obj[header] =
                            row[index] ?? "";

                    }
                );


                return obj;

            });

        }


        /* ================================================
           LOAD DATA
        ================================================ */

        async function loadData() {

            try {

                const response =
                    await fetch(
                        "../data/bank_clean.csv"
                    );


                if (!response.ok) {

                    throw new Error(
                        "Cannot load bank_clean.csv"
                    );

                }


                const csv =
                    await response.text();


                const parsed =
                    parseCSV(csv);


                data.value =
                    parsed.map(d => ({

                        ...d,

                        age:
                            Number(d.age),

                        balance:
                            Number(d.balance),

                        duration:
                            Number(d.duration),

                        campaign:
                            Number(d.campaign),

                        pdays:
                            Number(d.pdays),

                        previous:
                            Number(d.previous),

                        day:
                            Number(d.day)

                    }));


                console.log(
                    "Loaded:",
                    data.value.length,
                    "records"
                );


                await nextTick();

                updateCharts();

            }
            catch (error) {

                console.error(
                    "Data loading error:",
                    error
                );

            }

        }


        /* ================================================
           JOB LIST
        ================================================ */

        const jobs = computed(() => {

            return [

                ...new Set(

                    data.value
                        .map(d => d.job)
                        .filter(Boolean)

                )

            ].sort();

        });


        /* ================================================
           FILTERED DATA
        ================================================ */

        const filteredData = computed(() => {

            const search =
                searchText.value
                    .toLowerCase()
                    .trim();


            return data.value.filter(d => {

                const jobMatch =

                    jobFilter.value === "All" ||
                    d.job === jobFilter.value;


                const depositMatch =

                    depositFilter.value === "All" ||
                    d.deposit === depositFilter.value;


                const searchMatch =

                    !search ||

                    `${d.job}
                     ${d.age}
                     ${d.balance}
                     ${d.housing}
                     ${d.loan}
                     ${d.deposit}`
                        .toLowerCase()
                        .includes(search);


                return (
                    jobMatch &&
                    depositMatch &&
                    searchMatch
                );

            });

        });


        /* ================================================
           KPI
        ================================================ */

        const totalCustomers =
            computed(() =>
                filteredData.value.length
            );


        const depositYes =
            computed(() =>
                filteredData.value.filter(
                    d =>
                        d.deposit === "yes"
                ).length
            );


        const depositRate =
            computed(() => {

                if (
                    !filteredData.value.length
                ) {

                    return "0.0";

                }


                return (

                    (
                        depositYes.value /
                        filteredData.value.length
                    ) * 100

                ).toFixed(1);

            });


        const averageAge =
            computed(() => {

                if (
                    !filteredData.value.length
                ) {

                    return "0.0";

                }


                const total =
                    filteredData.value.reduce(
                        (sum, d) =>
                            sum + d.age,
                        0
                    );


                return (

                    total /
                    filteredData.value.length

                ).toFixed(1);

            });


        const averageBalance =
            computed(() => {

                if (
                    !filteredData.value.length
                ) {

                    return 0;

                }


                const total =
                    filteredData.value.reduce(
                        (sum, d) =>
                            sum + d.balance,
                        0
                    );


                return Math.round(

                    total /
                    filteredData.value.length

                );

            });


        /* ================================================
           PAGINATION
        ================================================ */

        const totalPages =
            computed(() => {

                return Math.max(

                    1,

                    Math.ceil(

                        filteredData.value.length /
                        rowsPerPage

                    )

                );

            });


        const paginatedData =
            computed(() => {

                const start =

                    (
                        currentPage.value - 1
                    ) *
                    rowsPerPage;


                return filteredData.value.slice(

                    start,

                    start + rowsPerPage

                );

            });


        const startRecord =
            computed(() => {

                if (
                    !filteredData.value.length
                ) {

                    return 0;

                }


                return (

                    (
                        currentPage.value - 1
                    ) *
                    rowsPerPage

                ) + 1;

            });


        const endRecord =
            computed(() => {

                return Math.min(

                    currentPage.value *
                    rowsPerPage,

                    filteredData.value.length

                );

            });


        const visiblePages =
            computed(() => {

                const pages = [];

                const maxPages = 5;


                let start = Math.max(

                    1,

                    currentPage.value - 2

                );


                let end = Math.min(

                    totalPages.value,

                    start +
                    maxPages -
                    1

                );


                if (
                    end - start + 1 <
                    maxPages
                ) {

                    start = Math.max(

                        1,

                        end -
                        maxPages +
                        1

                    );

                }


                for (
                    let i = start;
                    i <= end;
                    i++
                ) {

                    pages.push(i);

                }


                return pages;

            });


        /* ================================================
           PAGINATION BUTTONS
        ================================================ */

        function previousPage() {

            if (
                currentPage.value > 1
            ) {

                currentPage.value--;

            }

        }


        function nextPage() {

            if (
                currentPage.value <
                totalPages.value
            ) {

                currentPage.value++;

            }

        }


        /* ================================================
           RESET FILTERS
        ================================================ */

        function resetFilters() {

            depositFilter.value =
                "All";

            jobFilter.value =
                "All";

            searchText.value =
                "";

            currentPage.value =
                1;


            nextTick(() => {

                updateCharts();

            });

        }


        /* ================================================
           DONUT CENTER TEXT
        ================================================ */

        const centerTextPlugin = {

            id:
                "centerTextPlugin",


            beforeDraw(chart) {

                if (
                    chart.config.type !==
                    "doughnut"
                ) {

                    return;

                }


                const {
                    ctx,
                    chartArea
                } = chart;


                if (!chartArea) {

                    return;

                }


                const yes =
                    filteredData.value.filter(
                        d =>
                            d.deposit === "yes"
                    ).length;


                const total =
                    filteredData.value.length;


                const percent =

                    total === 0
                        ? 0
                        :
                        (
                            yes /
                            total
                        ) * 100;


                const x =

                    (
                        chartArea.left +
                        chartArea.right
                    ) / 2;


                const y =

                    (
                        chartArea.top +
                        chartArea.bottom
                    ) / 2;


                ctx.save();


                ctx.textAlign =
                    "center";


                ctx.textBaseline =
                    "middle";


                ctx.font =
                    "700 28px Segoe UI";


                ctx.fillStyle =
                    "#5B504C";


                ctx.fillText(

                    percent.toFixed(1) + "%",

                    x,

                    y - 8

                );


                ctx.font =
                    "11px Segoe UI";


                ctx.fillStyle =
                    "#A19894";


                ctx.fillText(

                    "Deposit Rate",

                    x,

                    y + 18

                );


                ctx.restore();

            }

        };


        Chart.register(
            centerTextPlugin
        );


        /* ================================================
           BAR CHART
        ================================================ */

        function createJobChart() {

            const canvas =
                document.getElementById(
                    "jobChart"
                );


            if (!canvas) return;


            if (jobChart) {

                jobChart.destroy();

                jobChart = null;

            }


            const grouped = {};


            filteredData.value
                .filter(
                    d =>
                        d.deposit === "yes"
                )
                .forEach(d => {

                    grouped[d.job] =

                        (
                            grouped[d.job] ||
                            0
                        ) + 1;

                });


            const chartData =

                Object.entries(grouped)

                    .map(
                        ([job, count]) => ({
                            job,
                            count
                        })
                    )

                    .sort(
                        (a, b) =>
                            b.count -
                            a.count
                    );


            const colors = [

                "#F5A9B8",
                "#F6B995",
                "#F3D47A",
                "#A9DDEB",
                "#F7C5D0",
                "#FFD0A8",
                "#B8E3EC",
                "#FFE4A8",
                "#F4B8C4",
                "#AFCFE5",
                "#F8CBA6",
                "#D6C4E9"

            ];


            jobChart =
                new Chart(

                    canvas,

                    {

                        type:
                            "bar",


                        data: {

                            labels:

                                chartData.map(
                                    d =>
                                        d.job
                                ),


                            datasets: [

                                {

                                    data:

                                        chartData.map(
                                            d =>
                                                d.count
                                        ),


                                    backgroundColor:
                                        colors.slice(
                                            0,
                                            chartData.length
                                        ),


                                    borderRadius:
                                        10,


                                    borderSkipped:
                                        false,


                                    hoverBackgroundColor:
                                        "#E98F9F",


                                    hoverBorderColor:
                                        "#D8798B",


                                    hoverBorderWidth:
                                        3

                                }

                            ]

                        },


                        options: {

                            indexAxis:
                                "y",


                            responsive:
                                true,


                            maintainAspectRatio:
                                false,


                            animation: {

                                duration:
                                    1600,

                                easing:
                                    "easeOutQuart"

                            },


                            plugins: {

                                legend: {

                                    display:
                                        false

                                }

                            },


                            scales: {

                                x: {

                                    beginAtZero:
                                        true,

                                    grid: {

                                        color:
                                            "#F3EAE6"

                                    }

                                },


                                y: {

                                    grid: {

                                        display:
                                            false

                                    }

                                }

                            }

                        }

                    }

                );


            /* Click graph */

            canvas.onclick =
                function(event) {

                    const elements =

                        jobChart.getElementsAtEventForMode(

                            event,

                            "nearest",

                            {
                                intersect:
                                    true
                            },

                            true

                        );


                    if (
                        !elements.length
                    ) {

                        return;

                    }


                    const index =
                        elements[0].index;


                    const selectedJob =
                        chartData[index].job;


                    jobFilter.value =

                        jobFilter.value ===
                        selectedJob

                            ? "All"

                            : selectedJob;

                };


            canvas.style.cursor =
                "pointer";

        }


        /* ================================================
           DONUT CHART
        ================================================ */

        function createDepositChart() {

            const canvas =
                document.getElementById(
                    "depositChart"
                );


            if (!canvas) return;


            if (depositChart) {

                depositChart.destroy();

                depositChart = null;

            }


            const yes =
                filteredData.value.filter(
                    d =>
                        d.deposit === "yes"
                ).length;


            const no =
                filteredData.value.filter(
                    d =>
                        d.deposit === "no"
                ).length;


            depositChart =
                new Chart(

                    canvas,

                    {

                        type:
                            "doughnut",


                        data: {

                            labels: [

                                "Yes (ฝากเงิน)",

                                "No (ไม่ฝากเงิน)"

                            ],


                            datasets: [

                                {

                                    data: [

                                        yes,

                                        no

                                    ],


                                    backgroundColor: [

                                        "#F5A9B8",

                                        "#A9DDEB"

                                    ],


                                    borderColor:
                                        "#FFFFFF",


                                    borderWidth:
                                        5,


                                    hoverOffset:
                                        18

                                }

                            ]

                        },


                        options: {

                            responsive:
                                true,


                            maintainAspectRatio:
                                false,


                            cutout:
                                "68%",


                            animation: {

                                animateRotate:
                                    true,

                                animateScale:
                                    true,

                                duration:
                                    1800,

                                easing:
                                    "easeOutBack"

                            },


                            plugins: {

                                legend: {

                                    position:
                                        "bottom",

                                    labels: {

                                        usePointStyle:
                                            true,

                                        padding:
                                            18

                                    }

                                },


                                tooltip: {

                                    callbacks: {

                                        label:
                                            function(context) {

                                                const total =
                                                    yes + no;


                                                const percent =

                                                    total === 0
                                                        ? 0
                                                        :
                                                        (
                                                            context.raw /
                                                            total
                                                        ) * 100;


                                                return (

                                                    context.label +
                                                    ": " +
                                                    context.raw +
                                                    " คน (" +
                                                    percent.toFixed(1) +
                                                    "%)"

                                                );

                                            }

                                    }

                                }

                            }

                        }

                    }

                );


            /* Click donut */

            canvas.onclick =
                function(event) {

                    const elements =

                        depositChart.getElementsAtEventForMode(

                            event,

                            "nearest",

                            {
                                intersect:
                                    true
                            },

                            true

                        );


                    if (
                        !elements.length
                    ) {

                        return;

                    }


                    const index =
                        elements[0].index;


                    const status =

                        index === 0
                            ? "yes"
                            : "no";


                    depositFilter.value =

                        depositFilter.value ===
                        status

                            ? "All"

                            : status;

                };


            canvas.style.cursor =
                "pointer";

        }


        /* ================================================
           LINE CHART
        ================================================ */

        function createMonthChart() {

            const canvas =
                document.getElementById(
                    "monthChart"
                );


            if (!canvas) return;


            if (monthChart) {

                monthChart.destroy();

                monthChart = null;

            }


            const months = [

                "jan",
                "feb",
                "mar",
                "apr",
                "may",
                "jun",
                "jul",
                "aug",
                "sep",
                "oct",
                "nov",
                "dec"

            ];


            const labels = [

                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec"

            ];


            const values =

                months.map(month => {

                    return filteredData.value.filter(
                        d => {

                            if (!d.month) {

                                return false;

                            }


                            return (

                                d.month
                                    .toLowerCase()
                                    .substring(
                                        0,
                                        3
                                    ) === month &&

                                d.deposit ===
                                "yes"

                            );

                        }
                    ).length;

                });


            monthChart =
                new Chart(

                    canvas,

                    {

                        type:
                            "line",


                        data: {

                            labels,


                            datasets: [

                                {

                                    data:
                                        values,


                                    borderColor:
                                        "#F3B35C",


                                    backgroundColor:
                                        "rgba(243,179,92,0.18)",


                                    fill:
                                        true,


                                    tension:
                                        0.35,


                                    pointBackgroundColor:
                                        "#F5A9B8",


                                    pointBorderColor:
                                        "#FFFFFF",


                                    pointBorderWidth:
                                        2,


                                    pointRadius:
                                        5,


                                    pointHoverRadius:
                                        11

                                }

                            ]

                        },


                        options: {

                            responsive:
                                true,


                            maintainAspectRatio:
                                false,


                            animation: {

                                duration:
                                    1800,

                                easing:
                                    "easeInOutQuart"

                            },


                            plugins: {

                                legend: {

                                    display:
                                        false

                                }

                            },


                            scales: {

                                y: {

                                    beginAtZero:
                                        true,

                                    grid: {

                                        color:
                                            "#F4EAE5"

                                    }

                                },


                                x: {

                                    grid: {

                                        display:
                                            false

                                    }

                                }

                            }

                        }

                    }

                );


            canvas.onclick =
                function(event) {

                    const elements =

                        monthChart.getElementsAtEventForMode(

                            event,

                            "nearest",

                            {
                                intersect:
                                    true
                            },

                            true

                        );


                    if (
                        elements.length
                    ) {

                        const index =
                            elements[0].index;


                        monthChart.setActiveElements([

                            {

                                datasetIndex:
                                    0,

                                index:
                                    index

                            }

                        ]);


                        monthChart.update();


                    }

                };


            canvas.style.cursor =
                "pointer";

        }


        /* ================================================
           SCATTER CHART
        ================================================ */

        function createScatterChart() {

            const canvas =
                document.getElementById(
                    "scatterChart"
                );


            if (!canvas) return;


            if (scatterChart) {

                scatterChart.destroy();

                scatterChart = null;

            }


            const points =

                filteredData.value
                    .slice(0, 1000)
                    .map(d => ({

                        x:
                            d.age,

                        y:
                            d.balance

                    }));


            scatterChart =
                new Chart(

                    canvas,

                    {

                        type:
                            "scatter",


                        data: {

                            datasets: [

                                {

                                    data:
                                        points,


                                    backgroundColor:
                                        "rgba(125,194,214,0.45)",


                                    borderColor:
                                        "#7DC2D6",


                                    pointRadius:
                                        4,


                                    pointHoverRadius:
                                        10,


                                    pointHoverBackgroundColor:
                                        "#F5A9B8"

                                }

                            ]

                        },


                        options: {

                            responsive:
                                true,


                            maintainAspectRatio:
                                false,


                            animation: {

                                duration:
                                    1500,

                                easing:
                                    "easeOutBack"

                            },


                            plugins: {

                                legend: {

                                    display:
                                        false

                                }

                            },


                            scales: {

                                x: {

                                    title: {

                                        display:
                                            true,

                                        text:
                                            "Age"

                                    },


                                    grid: {

                                        color:
                                            "#F4EAE5"

                                    }

                                },


                                y: {

                                    title: {

                                        display:
                                            true,

                                        text:
                                            "Balance"

                                    },


                                    grid: {

                                        color:
                                            "#F4EAE5"

                                    }

                                }

                            }

                        }

                    }

                );


            canvas.onclick =
                function(event) {

                    const elements =

                        scatterChart.getElementsAtEventForMode(

                            event,

                            "nearest",

                            {
                                intersect:
                                    true
                            },

                            true

                        );


                    if (
                        elements.length
                    ) {

                        const index =
                            elements[0].index;


                        scatterChart.setActiveElements([

                            {

                                datasetIndex:
                                    0,

                                index:
                                    index

                            }

                        ]);


                        scatterChart.update();

                    }

                };


            canvas.style.cursor =
                "pointer";

        }


        /* ================================================
           UPDATE ALL CHARTS
        ================================================ */

        function updateCharts() {

            if (
                typeof Chart ===
                "undefined"
            ) {

                console.error(
                    "Chart.js not loaded"
                );

                return;

            }


            createJobChart();

            createDepositChart();

            createMonthChart();

            createScatterChart();

        }


        /* ================================================
           REPLAY BUTTONS
        ================================================ */

        function replayJobChart() {

            console.log(
                "Replay Job Chart"
            );


            if (jobChart) {

                jobChart.destroy();

                jobChart = null;

            }


            nextTick(() => {

                createJobChart();

            });

        }


        function replayDepositChart() {

            console.log(
                "Replay Deposit Chart"
            );


            if (depositChart) {

                depositChart.destroy();

                depositChart = null;

            }


            nextTick(() => {

                createDepositChart();

            });

        }


        function replayMonthChart() {

            console.log(
                "Replay Monthly Chart"
            );


            if (monthChart) {

                monthChart.destroy();

                monthChart = null;

            }


            nextTick(() => {

                createMonthChart();

            });

        }


        function replayScatterChart() {

            console.log(
                "Replay Scatter Chart"
            );


            if (scatterChart) {

                scatterChart.destroy();

                scatterChart = null;

            }


            nextTick(() => {

                createScatterChart();

            });

        }


        /* ================================================
           WATCH FILTERS
        ================================================ */

        watch(

            [
                depositFilter,
                jobFilter,
                searchText
            ],

            () => {

                currentPage.value =
                    1;


                nextTick(() => {

                    updateCharts();

                });

            }

        );


        /* ================================================
           START
        ================================================ */

        onMounted(
            async () => {

                await loadData();

                console.log(
                    "BankFlow Dashboard Ready"
                );

            }
        );


        /* ================================================
           RETURN TO VUE
        ================================================ */

        return {

            data,

            jobs,

            depositFilter,

            jobFilter,

            searchText,

            filteredData,

            totalCustomers,

            depositYes,

            depositRate,

            averageAge,

            averageBalance,

            currentPage,

            totalPages,

            paginatedData,

            startRecord,

            endRecord,

            visiblePages,

            previousPage,

            nextPage,

            resetFilters,

            replayJobChart,

            replayDepositChart,

            replayMonthChart,

            replayScatterChart

        };

    }

}).mount("#app");