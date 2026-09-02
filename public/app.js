let socket = null;
let gameState = null;
let myPlayerId = null;


/* =========================================================
   VERBINDUNG ZUM SERVER
========================================================= */

function connect() {

    const protocol =
        window.location.protocol === "https:"
            ? "wss"
            : "ws";

    const url =
        `${protocol}://${window.location.host}`;

    console.log("WebSocket Verbindung zu:", url);

    socket = new WebSocket(url);


    socket.onopen = function () {

        console.log("WebSocket verbunden");

        const status =
            document.getElementById("connectionStatus");

        if (status) {
            status.textContent =
                "🟢 Online verbunden";
        }
    };


    socket.onclose = function () {

        console.log("WebSocket getrennt");

        const status =
            document.getElementById("connectionStatus");

        if (status) {
            status.textContent =
                "🔴 Verbindung getrennt";
        }
    };


    socket.onerror = function (error) {

        console.error(
            "WebSocket Fehler:",
            error
        );

        const status =
            document.getElementById("connectionStatus");

        if (status) {
            status.textContent =
                "❌ Serverfehler";
        }
    };


    socket.onmessage = function (event) {

        console.log(
            "Server:",
            event.data
        );

        let message;

        try {

            message =
                JSON.parse(
                    event.data
                );

        } catch (error) {

            console.error(
                "Ungültige Serverantwort:",
                error
            );

            return;
        }

        handleMessage(message);
    };
}


/* =========================================================
   SERVER-NACHRICHTEN
========================================================= */

function handleMessage(message) {

    console.log(
        "Nachricht:",
        message
    );


    /* Verbindung */

    if (
        message.type ===
        "connected"
    ) {

        return;
    }


    /* Raum erstellt */

    if (
        message.type ===
        "roomCreated"
    ) {

        myPlayerId =
            message.playerId;


        document.getElementById(
            "roomCode"
        ).textContent =
            message.roomCode;


        showRoom();

        return;
    }


    /* Raum beigetreten */

    if (
        message.type ===
        "roomJoined"
    ) {

        myPlayerId =
            message.playerId;


        document.getElementById(
            "roomCode"
        ).textContent =
            message.roomCode;


        showRoom();

        return;
    }


    /* Spielstand */

    if (
        message.type ===
        "state"
    ) {

        gameState =
            message.game;


        /*
         * Der Server sendet die eigene ID
         * jetzt bei jedem Spielstand.
         */

        if (
            gameState &&
            gameState.yourId
        ) {

            myPlayerId =
                gameState.yourId;
        }


        render();

        return;
    }


    /* Fehler */

    if (
        message.type ===
        "error"
    ) {

        alert(
            "❌ " +
            message.message
        );

        return;
    }


    /* Kaufangebot */

    if (
        message.type ===
        "purchaseOffer"
    ) {

        showPurchaseOffer(
            message.fieldIndex,
            message.field
        );

        return;
    }


    /* Aktie */

    if (
        message.type ===
        "stockOffer"
    ) {

        showStockOffer(
            message.price
        );

        return;
    }


    /* Bank */

    if (
        message.type ===
        "bankMenu"
    ) {

        showBankMenu();

        return;
    }


    /* Ausbau */

    if (
        message.type ===
        "buildMenu"
    ) {

        showBuildMenu();

        return;
    }
}


/* =========================================================
   NACHRICHT AN SERVER
========================================================= */

function send(
    type,
    data = {}
) {

    if (
        !socket ||
        socket.readyState !==
            WebSocket.OPEN
    ) {

        alert(
            "❌ Keine Verbindung zum Server."
        );

        return false;
    }


    const message = {
        type,
        ...data
    };


    console.log(
        "An Server:",
        message
    );


    socket.send(
        JSON.stringify(
            message
        )
    );


    return true;
}


/* =========================================================
   RAUM ERSTELLEN
========================================================= */

function createRoom() {

    const input =
        document.getElementById(
            "nameInput"
        );


    const name =
        input.value.trim();


    if (!name) {

        alert(
            "Bitte deinen Namen eingeben."
        );

        input.focus();

        return;
    }


    send(
        "createRoom",
        {
            name
        }
    );
}


/* =========================================================
   RAUM BEITRETEN
========================================================= */

function joinRoom() {

    const name =
        document.getElementById(
            "nameInput"
        ).value.trim();


    const code =
        document.getElementById(
            "roomInput"
        ).value.trim()
            .toUpperCase();


    if (!name) {

        alert(
            "Bitte deinen Namen eingeben."
        );

        return;
    }


    if (
        code.length !== 6
    ) {

        alert(
            "Der Raumcode muss 6 Zeichen haben."
        );

        return;
    }


    send(
        "joinRoom",
        {
            name,
            code
        }
    );
}


/* =========================================================
   RAUM ANZEIGEN
========================================================= */

function showRoom() {

    const lobby =
        document.getElementById(
            "lobby"
        );

    const room =
        document.getElementById(
            "room"
        );


    if (lobby) {

        lobby.classList.add(
            "hidden"
        );
    }


    if (room) {

        room.classList.remove(
            "hidden"
        );
    }
}


/* =========================================================
   SPIEL STARTEN
========================================================= */

function startGame() {

    send(
        "startGame"
    );
}


/* =========================================================
   HAUPT-RENDER
========================================================= */

function render() {

    if (!gameState) {

        return;
    }


    if (
        gameState.status ===
        "lobby"
    ) {

        renderLobby();

        return;
    }


    renderGame();
}


/* =========================================================
   LOBBY
========================================================= */

function renderLobby() {

    const lobby =
        document.getElementById(
            "lobby"
        );

    const room =
        document.getElementById(
            "room"
        );

    const game =
        document.getElementById(
            "game"
        );


    if (lobby) {
        lobby.classList.add(
            "hidden"
        );
    }

    if (room) {
        room.classList.remove(
            "hidden"
        );
    }

    if (game) {
        game.classList.add(
            "hidden"
        );
    }


    const roomCode =
        document.getElementById(
            "roomCode"
        );


    if (roomCode) {

        roomCode.textContent =
            gameState.roomCode;
    }


    const box =
        document.getElementById(
            "lobbyPlayers"
        );


    if (!box) {
        return;
    }


    box.innerHTML = "";


    gameState.players.forEach(
        player => {

            const div =
                document.createElement(
                    "div"
                );


            div.style.padding =
                "12px";

            div.style.margin =
                "7px 0";

            div.style.border =
                "1px solid #ddd";

            div.style.borderRadius =
                "10px";


            div.innerHTML = `
                ${player.symbol}
                <strong>
                    ${escapeHtml(
                        player.name
                    )}
                </strong>

                ${
                    player.id ===
                    gameState.hostId
                        ? " 👑 Host"
                        : ""
                }
            `;


            box.appendChild(
                div
            );
        }
    );


    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.disabled =
            gameState.players.length < 2
            ||
            gameState.hostId !==
                myPlayerId;
    }
}


/* =========================================================
   SPIEL RENDERN
========================================================= */

function renderGame() {

    const lobby =
        document.getElementById(
            "lobby"
        );

    const room =
        document.getElementById(
            "room"
        );

    const game =
        document.getElementById(
            "game"
        );


    if (lobby) {
        lobby.classList.add(
            "hidden"
        );
    }

    if (room) {
        room.classList.add(
            "hidden"
        );
    }

    if (game) {
        game.classList.remove(
            "hidden"
        );
    }


    const current =
        getCurrentPlayer();


    const me =
        getMe();


    const round =
        document.getElementById(
            "round"
        );

    if (round) {
        round.textContent =
            gameState.round;
    }


    const turn =
        document.getElementById(
            "turn"
        );

    if (turn) {

        turn.textContent =
            current
                ? `${current.symbol} ${current.name}`
                : "-";
    }


    const dice =
        document.getElementById(
            "dice"
        );

    if (dice) {

        dice.textContent =
            gameState.lastDice || "-";
    }


    const stockPrice =
        document.getElementById(
            "stockPrice"
        );

    if (stockPrice) {

        stockPrice.textContent =
            `${gameState.stockPrice} Fr.`;
    }


    /*
     * ENTSCHEIDEND:
     * Bin ich der Spieler, der gerade dran ist?
     */

    const myTurn =
        Boolean(
            current &&
            me &&
            current.id === me.id &&
            me.active &&
            gameState.status ===
                "playing"
        );


    console.log(
        "myPlayerId:",
        myPlayerId,
        "me:",
        me,
        "current:",
        current,
        "myTurn:",
        myTurn
    );


    const rollButton =
        document.getElementById(
            "rollButton"
        );


    if (rollButton) {

        rollButton.disabled =
            !myTurn;
    }


    const actionText =
        document.getElementById(
            "actionText"
        );


    if (actionText) {

        if (
            gameState.status ===
            "finished"
        ) {

            const winner =
                gameState.players.find(
                    player =>
                        player.active
                );


            actionText.textContent =
                winner
                    ? `🏆 ${winner.name} gewinnt!`
                    : "🏁 Spiel beendet";

        } else if (myTurn) {

            actionText.textContent =
                "🎲 DU BIST DRAN!";

        } else if (current) {

            actionText.textContent =
                `⏳ ${current.name} ist dran.`;
        }
    }


    renderBoard();

    renderPlayers();

    renderCompanies();

    renderLog();
}


/* =========================================================
   MEIN SPIELER
========================================================= */

function getMe() {

    if (!gameState) {

        return null;
    }


    /*
     * Erst über yourId
     */

    if (
        gameState.yourId
    ) {

        const player =
            gameState.players.find(
                p =>
                    p.id ===
                    gameState.yourId
            );


        if (player) {

            return player;
        }
    }


    /*
     * Danach über gespeicherte ID
     */

    if (myPlayerId) {

        const player =
            gameState.players.find(
                p =>
                    p.id ===
                    myPlayerId
            );


        if (player) {

            return player;
        }
    }


    return null;
}


/* =========================================================
   AKTUELLER SPIELER
========================================================= */

function getCurrentPlayer() {

    if (
        !gameState ||
        !gameState.turnOrder
    ) {

        return null;
    }


    const id =
        gameState.turnOrder[
            gameState.currentTurn
        ];


    return gameState.players.find(
        player =>
            player.id === id
    );
}


/* =========================================================
   WÜRFELN
========================================================= */

function rollDice() {

    const me =
        getMe();


    const current =
        getCurrentPlayer();


    if (!me) {

        alert(
            "Spieler-ID nicht gefunden. Seite neu laden."
        );

        return;
    }


    if (!current) {

        return;
    }


    if (
        me.id !==
        current.id
    ) {

        alert(
            `Du bist nicht dran. ${current.name} ist am Zug.`
        );

        return;
    }


    if (
        !me.active
    ) {

        return;
    }


    send(
        "roll"
    );
}


/* =========================================================
   UNTERNEHMEN KAUFEN
========================================================= */

function showPurchaseOffer(
    fieldIndex,
    field
) {

    showPopup(

        "🏢 Unternehmen kaufen",

        `
        <p>
            <strong>
                ${escapeHtml(
                    field.name
                )}
            </strong>
        </p>

        <p>
            Kaufpreis:
            <strong>
                ${money(field.price)} Fr.
            </strong>
        </p>

        <p>
            Miete:
            <strong>
                ${money(field.rent)} Fr.
            </strong>
        </p>

        <p>
            Einkommen:
            <strong>
                ${money(field.income)} Fr./Runde
            </strong>
        </p>
        `,

        [

            {
                text:
                    "✅ Kaufen",

                className:
                    "green",

                action:
                    function() {

                        send(
                            "buyCompany",
                            {
                                fieldIndex
                            }
                        );

                        closePopup();
                    }
            },

            {
                text:
                    "❌ Nicht kaufen",

                className:
                    "red",

                action:
                    function() {

                        send(
                            "buyCompany",
                            {
                                fieldIndex:
                                    -1
                            }
                        );

                        closePopup();
                    }
            }

        ]
    );
}


/* =========================================================
   AKTIEN
========================================================= */

function buyStockButton() {

    const current =
        getCurrentPlayer();


    const me =
        getMe();


    if (
        !current ||
        !me ||
        current.id !== me.id
    ) {

        alert(
            "Du bist nicht dran."
        );

        return;
    }


    showStockOffer(
        gameState.stockPrice
    );
}


function showStockOffer(
    price
) {

    showPopup(

        "📈 Börse",

        `
        <p>
            Aktienkurs:
            <strong>
                ${money(price)} Fr.
            </strong>
        </p>

        <p>
            Eine Aktie bringt:
            <strong>
                60 Fr./Runde
            </strong>
        </p>
        `,

        [

            {
                text:
                    "📈 Kaufen",

                className:
                    "green",

                action:
                    function() {

                        send(
                            "buyStock",
                            {
                                buy:
                                    true
                            }
                        );

                        closePopup();
                    }
            },

            {
                text:
                    "❌ Nicht kaufen",

                className:
                    "red",

                action:
                    function() {

                        send(
                            "buyStock",
                            {
                                buy:
                                    false
                            }
                        );

                        closePopup();
                    }
            }

        ]
    );
}


/* =========================================================
   BANK
========================================================= */

function bank() {

    const current =
        getCurrentPlayer();


    const me =
        getMe();


    if (
        !current ||
        !me ||
        current.id !== me.id
    ) {

        alert(
            "Du bist nicht dran."
        );

        return;
    }


    showBankMenu();
}


function showBankMenu() {

    showPopup(

        "🏦 Bank",

        `
        <p>
            Kredit aufnehmen:
            <strong>
                +500 Fr.
            </strong>
        </p>

        <p>
            Kredit zurückzahlen:
            <strong>
                500 Fr.
            </strong>
        </p>
        `,

        [

            {
                text:
                    "💰 Kredit aufnehmen",

                className:
                    "green",

                action:
                    function() {

                        send(
                            "bank",
                            {
                                action:
                                    "loan"
                            }
                        );

                        closePopup();
                    }
            },

            {
                text:
                    "💸 Zurückzahlen",

                className:
                    "orange",

                action:
                    function() {

                        send(
                            "bank",
                            {
                                action:
                                    "repay"
                            }
                        );

                        closePopup();
                    }
            },

            {
                text:
                    "Schließen",

                className:
                    "red",

                action:
                    function() {

                        closePopup();
                    }
            }

        ]
    );
}


/* =========================================================
   AUSBAU
========================================================= */

function build() {

    const current =
        getCurrentPlayer();


    const me =
        getMe();


    if (
        !current ||
        !me ||
        current.id !== me.id
    ) {

        alert(
            "Du bist nicht dran."
        );

        return;
    }


    showBuildMenu();
}


function showBuildMenu() {

    showPopup(

        "🏗️ Unternehmen ausbauen",

        `
        <p>
            Eines deiner Unternehmen
            wird ausgebaut.
        </p>

        <p>
            Kosten:
            <strong>
                50 % des Kaufpreises
            </strong>
        </p>

        <p>
            Einkommen:
            <strong>
                +100 Fr./Runde
            </strong>
        </p>
        `,

        [

            {
                text:
                    "🏗️ Ausbauen",

                className:
                    "green",

                action:
                    function() {

                        send(
                            "build"
                        );

                        closePopup();
                    }
            },

            {
                text:
                    "Schließen",

                className:
                    "red",

                action:
                    function() {

                        closePopup();
                    }
            }

        ]
    );
}


/* =========================================================
   SPIELERLISTE
========================================================= */

function renderPlayers() {

    const box =
        document.getElementById(
            "players"
        );


    if (!box) {
        return;
    }


    box.innerHTML = "";


    const current =
        getCurrentPlayer();


    gameState.players.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "player-card";


            if (
                current &&
                current.id ===
                    player.id
            ) {

                card.classList.add(
                    "active"
                );
            }


            if (
                !player.active
            ) {

                card.classList.add(
                    "dead"
                );
            }


            card.innerHTML = `

                <h3>
                    ${player.symbol}
                    ${escapeHtml(
                        player.name
                    )}
                </h3>

                <div>
                    ${
                        player.active
                            ? "🟢 Im Spiel"
                            : "💀 Ausgeschieden"
                    }
                </div>

                <div>
                    💰 ${money(player.money)} Fr.
                </div>

                <div>
                    🏢 ${player.properties.length}
                    Unternehmen
                </div>

                <div>
                    📈 +${money(
                        getIncome(player)
                    )} Fr./Runde
                </div>

                <div>
                    📊 ${player.stocks} Aktien
                </div>

                <div>
                    🏦 Kredit:
                    ${money(player.loan)} Fr.
                </div>

            `;


            box.appendChild(
                card
            );
        }
    );
}


/* =========================================================
   BOARD
========================================================= */

function renderBoard() {

    const board =
        document.getElementById(
            "board"
        );


    if (!board) {
        return;
    }


    board.innerHTML = "";


    const current =
        getCurrentPlayer();


    gameState.fields.forEach(
        (field, index) => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "field " +
                field.type;


            if (
                current &&
                current.position ===
                    index
            ) {

                div.classList.add(
                    "current"
                );
            }


            let html =
                `<strong>${escapeHtml(
                    field.name
                )}</strong>`;


            if (
                field.type ===
                "company"
            ) {

                html += `
                    <small>
                        💰 Kauf:
                        ${money(field.price)} Fr.
                    </small>

                    <small>
                        💵 Miete:
                        ${money(field.rent)} Fr.
                    </small>

                    <small>
                        📈 +
                        ${money(field.income)}
                        Fr./Runde
                    </small>
                `;
            }


            if (
                field.type ===
                "tax"
            ) {

                html += `
                    <small>
                        💸 -
                        ${money(field.amount)}
                        Fr.
                    </small>
                `;
            }


            if (
                field.type ===
                "bonus"
            ) {

                html += `
                    <small>
                        🎁 +
                        ${money(field.amount)}
                        Fr.
                    </small>
                `;
            }


            if (
                field.type ===
                "police"
            ) {

                html += `
                    <small>
                        🚓 1x aussetzen
                    </small>
                `;
            }


            if (
                field.type ===
                "stock"
            ) {

                html += `
                    <small>
                        📈 Börse
                    </small>
                `;
            }


            if (
                field.type ===
                "bank"
            ) {

                html += `
                    <small>
                        🏦 Bank
                    </small>
                `;
            }


            if (
                field.type ===
                "risk"
            ) {

                html += `
                    <small>
                        🎲 Risiko
                    </small>
                `;
            }


            if (
                field.type ===
                "build"
            ) {

                html += `
                    <small>
                        🏗️ Ausbau
                    </small>
                `;
            }


            const owner =
                findOwner(index);


            if (owner) {

                html += `
                    <small>
                        🏠
                        ${owner.symbol}
                        ${escapeHtml(
                            owner.name
                        )}
                    </small>
                `;
            }


            html +=
                `<div class="tokens">`;


            gameState.players.forEach(
                player => {

                    if (
                        player.active &&
                        player.position ===
                            index
                    ) {

                        html +=
                            player.symbol;
                    }
                }
            );


            html +=
                `</div>`;


            div.innerHTML =
                html;


            board.appendChild(
                div
            );
        }
    );
}


/* =========================================================
   BESITZER
========================================================= */

function findOwner(
    fieldIndex
) {

    if (!gameState) {
        return null;
    }


    return gameState.players.find(
        player =>
            player.active &&
            player.properties.includes(
                fieldIndex
            )
    );
}


/* =========================================================
   UNTERNEHMEN
========================================================= */

function renderCompanies() {

    const box =
        document.getElementById(
            "companies"
        );


    if (!box) {
        return;
    }


    box.innerHTML = "";


    gameState.fields.forEach(
        (field, index) => {

            if (
                field.type !==
                "company"
            ) {

                return;
            }


            const owner =
                findOwner(index);


            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "company-card";


            div.innerHTML = `

                <strong>
                    ${escapeHtml(
                        field.name
                    )}
                </strong>

                <br>

                💰 Kauf:
                ${money(field.price)} Fr.

                <br>

                💵 Miete:
                ${money(field.rent)} Fr.

                <br>

                📈 Einkommen:
                ${money(field.income)}
                Fr./Runde

                <br><br>

                ${
                    owner
                        ? `${owner.symbol} ${escapeHtml(owner.name)}`
                        : "🟢 Frei"
                }

            `;


            box.appendChild(
                div
            );
        }
    );
}


/* =========================================================
   EINKOMMEN
========================================================= */

function getIncome(
    player
) {

    if (!gameState) {
        return 0;
    }


    let total = 0;


    player.properties.forEach(
        index => {

            const field =
                gameState.fields[index];


            if (
                field &&
                field.income
            ) {

                total +=
                    field.income;
            }
        }
    );


    total +=
        player.stocks * 60;


    return total;
}


/* =========================================================
   LOG
========================================================= */

function renderLog() {

    const box =
        document.getElementById(
            "log"
        );


    if (!box) {
        return;
    }


    box.innerHTML = "";


    if (
        !gameState.log
    ) {
        return;
    }


    [...gameState.log]
        .reverse()
        .forEach(
            message => {

                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "log-line";


                div.textContent =
                    message;


                box.appendChild(
                    div
                );
            }
        );
}


/* =========================================================
   POPUP
========================================================= */

function showPopup(
    title,
    html,
    buttons
) {

    const popup =
        document.getElementById(
            "popup"
        );


    const titleBox =
        document.getElementById(
            "popupTitle"
        );


    const textBox =
        document.getElementById(
            "popupText"
        );


    const buttonsBox =
        document.getElementById(
            "popupButtons"
        );


    if (
        !popup ||
        !titleBox ||
        !textBox ||
        !buttonsBox
    ) {

        return;
    }


    titleBox.textContent =
        title;


    textBox.innerHTML =
        html;


    buttonsBox.innerHTML =
        "";


    buttons.forEach(
        button => {

            const element =
                document.createElement(
                    "button"
                );


            element.textContent =
                button.text;


            element.className =
                button.className || "";


            element.onclick =
                button.action;


            buttonsBox.appendChild(
                element
            );
        }
    );


    popup.style.display =
        "flex";
}


function closePopup() {

    const popup =
        document.getElementById(
            "popup"
        );


    if (popup) {

        popup.style.display =
            "none";
    }
}


/* =========================================================
   HILFSFUNKTIONEN
========================================================= */

function money(value) {

    return Math.round(value)
        .toLocaleString("de-DE");
}


function escapeHtml(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;
}


/* =========================================================
   START
========================================================= */

connect();
