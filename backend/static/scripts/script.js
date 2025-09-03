document.addEventListener("DOMContentLoaded", () => {
  const processBtn = document.getElementById("processBtn");
  const clearBtn = document.getElementById("clearBtn");
  const emailText = document.getElementById("emailText");
  const fileInput = document.getElementById("fileInput");
  const loader = document.getElementById("loader");
  const resultsCard = document.getElementById("resultsCard");
  const resultsContainer = document.getElementById("results");
  const historyList = document.getElementById("historyList");
  const resultPopup = document.getElementById("resultPopup");
  const popupContent = document.getElementById("popupContent");
  const closePopup = document.getElementById("closePopup");
  const closeResults = document.getElementById("closeResults");
  const dropzone = document.getElementById("dropzone");

  // ---------------- DROPZONE ----------------

  if (dropzone) {
    // Agora sim: controla o clique manualmente
    dropzone.addEventListener("click", () => {
      fileInput.click(); // funciona em 1 clique só
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("drag");
    });

    // Máximo permitido = 20 MB
    const MAX_SIZE = 20 * 1024 * 1024;

    // Quando soltar o arquivo na dropzone
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag");
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.size > MAX_SIZE) {
          alert("O arquivo excede o limite de 5 MB.");
          return;
        }
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event("change"));
      }
    });

    // Quando escolher pelo input
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > MAX_SIZE) {
          alert("O arquivo excede o limite de 5 MB.");
          fileInput.value = ""; // reseta
          document.getElementById("fileName").textContent =
            "Nenhum arquivo selecionado";
          return;
        }
        document.getElementById("fileName").textContent = file.name;
      } else {
        document.getElementById("fileName").textContent =
          "Nenhum arquivo selecionado";
      }
    });
  }
  // -----------------------------------------

  function updateHistory(items) {
    let history = JSON.parse(localStorage.getItem("history")) || [];

    // adiciona ID único para cada item novo
    const itemsWithId = items.map((item) => ({
      ...item,
      id: Date.now() + Math.random().toString(16).slice(2), // id único
    }));

    history = [...itemsWithId, ...history];
    localStorage.setItem("history", JSON.stringify(history));
    renderHistory();
  }

  function renderHistory() {
    let history = JSON.parse(localStorage.getItem("history")) || [];
    historyList.innerHTML = "";
    history.forEach((h) => {
      const div = document.createElement("div");
      div.className = "history-item";
      const badgeClass =
        h.classification.toLowerCase() === "produtivo"
          ? "badge-prod"
          : "badge-improd";
      div.innerHTML = `
        <div style="display: flex; gap:10px">
          <div><i class="fa-solid fa-envelope"></i></div>
          <div>
            <div class="history-title-header">
                <span  title="${
                  h.sender || "Sem remetente"
                }" class="email-truncate">
                ${h.sender || "Sem remetente"}
                </span>
              <span class="badge-history ${badgeClass}">${
        h.classification
      }</span>
            </div>
            <div class="history-meta">
              ${h.date ? new Date(h.date).toLocaleString() : "Sem data"} | ${
        h.preview || "Sem conteúdo"
      }
          </div>
        </div>
        </div>
        <button class="delete-btn" data-id="${h.id}" style="
        background: transparent;
        border: none;
        color: var(--danger);
        cursor: pointer;
        font-size: 14px;
      ">
        <i class="fa-solid fa-trash"></i>
      </button>
      `;
      div.style.cursor = "pointer";
      div.addEventListener("click", () => showPopup(h));
      div.querySelector(".delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        deleteHistoryItem(h.id);
      });
      historyList.appendChild(div);
    });
  }

  function deleteHistoryItem(id) {
    let history = JSON.parse(localStorage.getItem("history")) || [];
    history = history.filter((item) => item.id !== id);
    localStorage.setItem("history", JSON.stringify(history));
    renderHistory();
  }

  function showPopup(data) {
    popupContent.innerHTML = `
      <div><strong>Data:</strong> ${
        data.date ? new Date(data.date).toLocaleString() : "Sem data"
      }</div>
      <div><strong>Remetente:</strong> ${data.sender || "Sem remetente"}</div>
      <div><strong>Assunto:</strong> ${data.subject || "Sem assunto"}</div>
      <div><strong>Classificação:</strong> ${data.classification || "—"}</div>
      <div><strong>Palavras-chave:</strong> ${(data.keywords || []).join(
        ", "
      )}</div>
      <div><strong>Prévia do texto:</strong><br>${data.preview || "—"}</div>
      <div><strong>Resposta sugerida:</strong><br>${data.reply || "—"}</div>
    `;
    resultPopup.style.display = "flex";
  }

  closePopup.addEventListener("click", () => {
    resultPopup.style.display = "none";
  });

  processBtn.addEventListener("click", async () => {
    processBtn.disabled = true;
    processBtn.innerHTML = `<i class="fa-solid fa-spinner" style="animation: spin 1s linear infinite; margin-right:8px;"></i> Processando...`;
    loader.style.display = "flex";

    try {
      resultsContainer.innerHTML = "";
      resultsContainer.classList.remove("show");
      resultsCard.style.display = "none";

      const formData = new FormData();

      if (fileInput.files.length > 0) {
        // 🔥 Envia o ARQUIVO real para o backend
        formData.append("file", fileInput.files[0]);
      } else if (emailText.value.trim() !== "") {
        // 🔥 Se não tiver arquivo, manda o texto digitado
        formData.append("text", emailText.value.trim());
      } else {
        alert("Insira ou faça upload de um email.");
        loader.style.display = "none";
        processBtn.disabled = false;
        processBtn.textContent = "Processar Email";
        return;
      }

      const res = await fetch("/process", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Erro ao processar emails");

      const emailsData = await res.json();

      resultsCard.style.display = "block";
      resultsContainer.classList.add("show");

      emailsData.forEach((email, index) => {
        email.preview = email.email_body.substring(0, 150) + "...";

        const infoDiv = document.createElement("div");
        infoDiv.className = "info";

        infoDiv.innerHTML = `
        <div class="result-card">
          <div class="result-title">Detalhes do Email ${String(
            index + 1
          ).padStart(2, "0")}</div>
          <div><strong>Remetente:</strong> ${email.sender}</div>
          <div><strong>Assunto:</strong> ${email.subject}</div>
          <div><strong>Data:</strong> ${
            email.date ? new Date(email.date).toLocaleString() : ""
          }</div>
        </div>

        <div class="result-card">
          <div class="result-title">Classificação:</div>
          <span class="badge ${
            email.classification.toLowerCase() === "produtivo"
              ? "success"
              : "warn"
          }">${email.classification}</span>
        </div>

        <div class="result-card">
          <div class="result-title">Palavras-chave / Insights:</div>
          <div id="keywords" class="chips">
            ${(email.keywords || [])
              .map((k) => `<span class="chip">${k}</span>`)
              .join("")}
          </div>
        </div>

        <div class="result-card">
          <div class="result-title">Prévia do texto:</div>
          ${email.preview}
        </div>

        <div class="result-card">
          <div class="result-title">Resposta sugerida</div>
          <div class="reply">${email.reply}</div>
          <div class="actions" style="margin-top: 10px">
            <button class="copyBtn btn tip" data-tip="Copiar para a área de transferência">
              <i class="fa-solid fa-copy"></i> Copiar
            </button>
          </div>
        </div>
      `;

        resultsContainer.appendChild(infoDiv);

        // ✅ pega o botão recém-criado e adiciona o evento só nele
        const copyBtn = infoDiv.querySelector(".copyBtn");
        const replyDiv = infoDiv.querySelector(".reply");

        copyBtn.addEventListener("click", () => {
          const textToCopy = replyDiv.innerText.trim();
          if (!textToCopy) return;

          navigator.clipboard.writeText(textToCopy).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.textContent = "Copiado!";
            setTimeout(() => {
              copyBtn.innerHTML = originalHTML;
            }, 1500);
          });
        });

        if (index < emailsData.length - 1) {
          const separator = document.createElement("div");
          separator.className = "separator";
          resultsContainer.appendChild(separator);
        }
      });

      updateHistory(emailsData);
    } catch (err) {
      alert(err.message);
    } finally {
      loader.style.display = "none";
      processBtn.disabled = false;
      processBtn.textContent = "Processar Email";
    }
  });

  // Botão "Limpar"
  clearBtn.addEventListener("click", () => {
    fileInput.value = ""; // reseta o input de arquivo
    document.getElementById("fileName").textContent =
      "Nenhum arquivo selecionado";

    // 🔥 Reativa o textarea
    emailText.disabled = false;
    emailText.value = "";
    emailText.style.opacity = "1";
    emailText.style.cursor = "text";
  });

  fileInput.addEventListener("change", () => {
    const fileName = document.getElementById("fileName");
    if (fileInput.files.length > 0) {
      fileName.textContent = fileInput.files[0].name;

      // 🔥 Limpa e desabilita o textarea
      emailText.value = "";
      emailText.disabled = true;
      emailText.style.opacity = "0.6";
      emailText.style.cursor = "not-allowed";
    } else {
      fileName.textContent = "Nenhum arquivo selecionado";

      // 🔥 Reativa o textarea
      emailText.disabled = false;
      emailText.style.opacity = "1";
      emailText.style.cursor = "text";
    }
  });

  document.getElementById("clearHistory").addEventListener("click", () => {
    localStorage.removeItem("history");
    renderHistory();
  });

  closeResults.addEventListener("click", () => {
    resultsContainer.innerHTML = "";
    resultsContainer.classList.remove("show");
    resultsCard.style.display = "none";
  });

  renderHistory();
});
