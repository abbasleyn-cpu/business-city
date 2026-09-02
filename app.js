let socket = null;

let gameState = null;

let myPlayerId = null;


/* =========================================================
   VERBINDUNG
========================================================= */

function connect() {

    const protocol =
        location.protocol === "https:"
            ? "wss"
            : "ws";


    socket =
        new WebSocket(
            `${protocol}://${location.host}`
        );


    socket.onopen = () => {

        document.getElementById(
            "connectionStatus"
        ).textContent =
            "🟢 Online verbunden";

    };


    socket.onclose = () => {

        document.getElementById(
            "connectionStatus"
        ).textContent =
            "🔴 Verbindung getrennt";

    };


    socket.onerror = () => {

        document.getElementById(
            "connectionStatus"
        ).textContent =
            "❌ Verbindungsfehler";

    };


    socket.onmessage = event => {

        let message;

        try {

            message =
                JSON.parse(
                    event.data
                );

        } catch {

            return;
        }


        handleMessage(message);
    };
}


/* =========================================================
   NACHRICHTEN
========================================================= */

function handleMessage(message) {

    /* Spieler hat Raum erstellt */

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


    /* Spieler ist Raum beigetreten */

    if (
        message.type ===
        "roomJoined"
    ) {

        /*
         * DAS IST DIE WICHTIGE KORREKTUR
         */

        myPlayerId =
            message.playerId;


        document.getElementById(
            "roomCode"
        ).textContent =
            message.roomCode;


        showRoom();

        return;
    }


    /* Server bestätigt Verbindung */

    if (
        message.type ===
        "connected"
    ) {

        return;
    }


    /* Spielstand */

    if (
        message.type ===
        "state"
    ) {

        gameState =
            message.game;


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


    /* Börse */

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


    /* Bauen */

    if (
        message.type ===
        "buildMenu"
    ) {

        showBuildMenu();

        return;
    }
}


/* =========================================================
   SENDEN
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
            "Keine Serververbindung."
        );

        return;
    }


    socket.send(
        JSON.stringify({

            type,

            ...data

        })
    );
}


/* =========================================================
   RAUM ERSTELLEN
========================================================= */

function createRoom() {

    const name =
        document.getElementById(
            "nameInput"
        ).value.trim();


    if (!name) {

        alert(
            "Bitte deinen Namen eingeben."
        );

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
   ROOM
========================================================= */

function showRoom() {

    document.getElementById(
        "lobby"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "room"
    ).classList.remove(
        "hidden"
    );
}


/* =========================================================
   START
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

        document.getElementById(
            "room"
        ).classList.remove(
            "hidden"
        );


        document.getElementById(
            "game"
        ).classList.add(
            "hidden"
        );


        renderLobby();

        return;
    }


    document.getElementById(
        "room"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "game"
    ).classList.remove(
        "hidden"
    );


    renderGame();
}


/* =========================================================
   LOBBY
========================================================= */

function renderLobby() {

    const box =
        document.getElementById(
            "lobbyPlayers"
        );


    box.innerHTML = "";


    gameState.players.forEach(
        player => {

            box.innerHTML += `

                <div
                    style="
                        padding:10px;
                        margin:7px 0;
                        border:1px solid #ddd;
                        border-radius:10px;
                    "
                >

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

                </div>

            `;
        }
    );


    document.getElementById(
        "roomCode"
    ).textContent =
        gameState.roomCode;


    document.getElementById(
        "startButton"
    ).disabled =
        gameState.players.length < 2
        ||
        gameState.hostId !== myPlayerId;
}


/* =========================================================
   GAME
========================================================= */

function renderGame() {

    const current =
        getCurrentPlayer();


    document.getElementById(
        "round"
    ).textContent =
        gameState.round;


    document.getElementById(
        "turn"
    ).textContent =
        current
            ? `${current.symbol} ${current.name}`
            : "-";


    document.getElementById(
        "dice"
    ).textContent =
        gameState.lastDice ||
        "-";


    document.getElementById(
        "stockPrice"
    ).textContent =
        `${gameState.stockPrice} Fr.`;


    const myTurn =
        current
        &&
        current.id ===
            myPlayerId
        &&
        current.active
        &&
        gameState.status ===
            "playing";


    document.getElementById(
        "rollButton"
    ).disabled =
        !myTurn;


    document.getElementById(
        "actionText"
    ).textContent =
        gameState.status ===
            "finished"

            ? "🏁 Spiel beendet"

            : myTurn

                ? "🎲 Du bist dran!"

                : current
                    ? `⏳ ${current.name} ist dran.`
                    : "-";


    renderBoard();

    renderPlayers();

    renderCompanies();

    renderLog();


    if (
        gameState.status ===
        "finished"
    ) {

        const winner =
            gameState.players.find(
                player =>
                    player.active
            );


        if (winner) {

            document.getElementById(
                "actionText"
            ).textContent =
                `🏆 ${winner.name} gewinnt!`;
        }
    }
}


/* =========================================================
   AKTUELLER SPIELER
========================================================= */

function getCurrentPlayer() {

    if (
        !gameState
        ||
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
   BOARD
========================================================= */

function renderBoard() {

    const board =
        document.getElementById(
            "board"
        );


    board.innerHTML = "";


    gameState.fields.forEach(
        (field, index) => {

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "field " +
                field.type;


            const current =
                getCurrentPlayer();


            if (
                current
                &&
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
                        💸 -${money(field.amount)} Fr.
                    </small>
                `;
            }


            if (
                field.type ===
                "bonus"
            ) {

                html += `
                    <small>
                        🎁 +${money(field.amount)} Fr.
                    </small>
                `;
            }


            if (
                field.type ===
                "police"
            ) {

                html += `
                    <small>
                        🚓 1 Runde aussetzen
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
                        player.active
                        &&
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

    return gameState.players.find(
        player =>
            player.active
            &&
            player.properties.includes(
                fieldIndex
            )
    );
}


/* =========================================================
   SPIELER
========================================================= */

function renderPlayers() {

    const box =
        document.getElementById(
            "players"
        );


    box.innerHTML = "";


    gameState.players.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "player-card";


            if (
                player.id ===
                getCurrentPlayer()?.id
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
                    💰
                    ${money(player.money)}
                    Fr.
                </div>

                <div>
                    🏢
                    ${player.properties.length}
                    Unternehmen
                </div>

                <div>
                    📈
                    +${money(
                        getIncome(player)
                    )} Fr./Runde
                </div>

                <div>
                    📊
                    ${player.stocks}
                    Aktien
                </div>

                <div>
                    🏦 Kredit:
                    ${money(player.loan)}
                    Fr.
                </div>

            `;


            box.appendChild(
                card
            );
        }
    );
}


/* =========================================================
   EINKOMMEN
========================================================= */

function getIncome(player) {

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
   UNTERNEHMEN
========================================================= */

function renderCompanies() {

    const box =
        document.getElementById(
            "companies"
        );


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
                ${money(field.income)} Fr./Runde

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
   LOG
========================================================= */

function renderLog() {

    const box =
        document.getElementById(
            "log"
        );


    box.innerHTML = "";


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
   WÜRFEL
========================================================= */

function rollDice() {

    send(
        "roll"
    );
}


/* =========================================================
   KAUFANGEBOT
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
                    () => {

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
                    () => {

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
                Eine Aktie bringt
                <strong>
                    60 Fr./Runde
                </strong>.
            </p>
        `,

        [

            {
                text:
                    "📈 Kaufen",

                className:
                    "green",

                action:
                    () => {

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
                    "Nicht kaufen",

                className:
                    "red",

                action:
                    () => {

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
                    "💰 Kredit",

                className:
                    "green",

                action:
                    () => {

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
                    () => {

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
                    "Abbrechen",

                className:
                    "red",

                action:
                    () => {

                        send(
                            "bank",
                            {
                                action:
                                    "repay"
                            }
                        );

                        closePopup();
                    }
            }

        ]
    );
}


/* =========================================================
   BAUEN
========================================================= */

function showBuildMenu() {

    showPopup(

        "🏗️ Unternehmen ausbauen",

        `
            <p>
                Ein eigenes Unternehmen
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
                    () => {

                        send(
                            "build"
                        );

                        closePopup();
                    }
            },

            {
                text:
                    "Abbrechen",

                className:
                    "red",

                action:
                    () => {

                        send(
                            "build"
                        );

                        closePopup();
                    }
            }

        ]
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

    document.getElementById(
        "popupTitle"
    ).textContent =
        title;


    document.getElementById(
        "popupText"
    ).innerHTML =
        html;


    const container =
        document.getElementById(
            "popupButtons"
        );


    container.innerHTML = "";


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


            container.appendChild(
                element
            );

        }
    );


    document.getElementById(
        "popup"
    ).style.display =
        "flex";
}


function closePopup() {

    document.getElementById(
        "popup"
    ).style.display =
        "none";
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
