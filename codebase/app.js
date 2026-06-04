// Main Application Logic for Techcombank Q&A Chatbot Prototype
// Enhanced with TF-IDF Search, Category Filtering, Confidence Scoring
// Integrated with OpenAI GPT API using ReAct (Reasoning + Acting) pattern

document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const chatTrigger = document.querySelector(".chatbot-trigger");
    const chatView = document.querySelector(".chat-view");
    const closeChat = document.querySelector(".close-chat");
    const chatMessages = document.querySelector(".chat-messages");
    const chatInput = document.querySelector(".chat-input");
    const sendBtn = document.querySelector(".send-btn");
    const suggestionsList = document.querySelector(".suggestions-list");

    let faqDatabase = [];
    let isAgentConnected = false;
    let agentBusyMode = true;
    let pendingCardLock = false;
    let faceIDAttempt = 0;

    // ===== Balance Toggle Eye Logic =====
    const balanceValue = document.querySelector(".balance-value");
    const balanceToggleEye = document.querySelector(".balance-toggle-eye");
    let isBalanceVisible = false;

    if (balanceToggleEye && balanceValue) {
        balanceToggleEye.addEventListener("click", (e) => {
            e.stopPropagation();
            isBalanceVisible = !isBalanceVisible;
            if (isBalanceVisible) {
                balanceValue.textContent = "1.000.000.000";
                balanceToggleEye.classList.remove("fa-eye-slash");
                balanceToggleEye.classList.add("fa-eye");
            } else {
                balanceValue.textContent = "*********";
                balanceToggleEye.classList.remove("fa-eye");
                balanceToggleEye.classList.add("fa-eye-slash");
            }
        });
    }

    // ===== Settings Modal Logic =====
    const settingsModal = document.getElementById("settingsModal");
    const openSettingsBtn = document.getElementById("openSettingsBtn");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const saveSettingsBtn = document.getElementById("saveSettingsBtn");
    const clearSettingsBtn = document.getElementById("clearSettingsBtn");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const modelSelect = document.getElementById("modelSelect");
    const toggleApiKeyVisibility = document.getElementById("toggleApiKeyVisibility");

    // ===== Helper functions to get API Key and Model =====
    function getApiKey() {
        const localKey = localStorage.getItem("openai_api_key");
        if (localKey && localKey.trim() !== "") {
            return localKey.trim();
        }
        const envKey = window.ENV?.OPENAI_API_KEY;
        if (envKey && envKey !== "sk-proj-YOUR_API_KEY_HERE" && envKey.trim() !== "") {
            return envKey.trim();
        }
        const envMistralKey = window.ENV?.MISTRAL_API_KEY;
        if (envMistralKey && envMistralKey.trim() !== "") {
            return envMistralKey.trim();
        }
        return "";
    }

    function getModel() {
        const localModel = localStorage.getItem("openai_model");
        if (localModel && localModel.trim() !== "") {
            return localModel.trim();
        }
        
        // If OpenAI API key is empty/not configured but Mistral is, use Mistral model
        const envKey = window.ENV?.OPENAI_API_KEY;
        const envMistralKey = window.ENV?.MISTRAL_API_KEY;
        if ((!envKey || envKey.trim() === "") && envMistralKey && envMistralKey.trim() !== "") {
            const envMistralModel = window.ENV?.MISTRAL_MODEL;
            if (envMistralModel && envMistralModel.trim() !== "") {
                return envMistralModel.trim();
            }
            return "mistral-large-latest";
        }

        const envModel = window.ENV?.OPENAI_MODEL;
        if (envModel && envModel.trim() !== "") {
            return envModel.trim();
        }
        return "gpt-4o-mini";
    }

    // Load initial settings
    apiKeyInput.value = getApiKey();
    modelSelect.value = getModel();

    if (openSettingsBtn) {
        openSettingsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            apiKeyInput.value = getApiKey();
            modelSelect.value = getModel();
            settingsModal.style.display = "flex";
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener("click", () => {
            settingsModal.style.display = "none";
        });
    }

    window.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = "none";
        }
    });

    if (toggleApiKeyVisibility) {
        toggleApiKeyVisibility.addEventListener("click", () => {
            if (apiKeyInput.type === "password") {
                apiKeyInput.type = "text";
                toggleApiKeyVisibility.classList.remove("fa-eye-slash");
                toggleApiKeyVisibility.classList.add("fa-eye");
            } else {
                apiKeyInput.type = "password";
                toggleApiKeyVisibility.classList.remove("fa-eye");
                toggleApiKeyVisibility.classList.add("fa-eye-slash");
            }
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener("click", () => {
            const key = apiKeyInput.value.trim();
            const model = modelSelect.value;

            if (key) {
                localStorage.setItem("openai_api_key", key);
                localStorage.setItem("openai_model", model);
                alert("Đã lưu cấu hình API thành công!");
                settingsModal.style.display = "none";
            } else {
                alert("Vui lòng nhập API Key.");
            }
        });
    }

    if (clearSettingsBtn) {
        clearSettingsBtn.addEventListener("click", () => {
            localStorage.removeItem("openai_api_key");
            localStorage.removeItem("openai_model");
            apiKeyInput.value = "";
            alert("Đã xóa API Key.");
            settingsModal.style.display = "none";
        });
    }

    // ===== Tool Indicator Control =====
    const toolIndicator = document.getElementById("toolIndicator");
    const toolIndicatorText = toolIndicator ? toolIndicator.querySelector(".tool-indicator-text") : null;

    function showToolIndicator(text) {
        if (toolIndicator) {
            toolIndicator.style.display = "block";
            if (toolIndicatorText) {
                toolIndicatorText.textContent = text;
            }
        }
    }

    function hideToolIndicator() {
        if (toolIndicator) {
            toolIndicator.style.display = "none";
        }
    }

    // ===== TF-IDF Search Engine =====
    class TFIDFSearch {
        constructor() {
            this.documents = [];
            this.idf = {};
            this.tfidfVectors = [];
            this.vocabulary = new Set();
        }

        // Tokenize Vietnamese text
        tokenize(text) {
            const cleaned = removeVietnameseTones(text.toLowerCase())
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return cleaned.split(' ').filter(w => w.length > 1);
        }

        // Build index from FAQ data
        buildIndex(faqs) {
            this.documents = faqs.map(faq => {
                const combined = faq.question + ' ' + faq.question + ' ' + faq.answer;
                const tokens = this.tokenize(combined);
                tokens.forEach(t => this.vocabulary.add(t));
                return { tokens, faq };
            });

            // Calculate IDF
            const N = this.documents.length;
            this.vocabulary.forEach(term => {
                const docCount = this.documents.filter(d => d.tokens.includes(term)).length;
                this.idf[term] = Math.log((N + 1) / (docCount + 1)) + 1;
            });

            // Pre-compute TF-IDF vectors
            this.tfidfVectors = this.documents.map(doc => this.computeTFIDF(doc.tokens));
        }

        computeTFIDF(tokens) {
            const tf = {};
            tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
            const maxTF = Math.max(...Object.values(tf), 1);

            const vector = {};
            Object.keys(tf).forEach(term => {
                vector[term] = (tf[term] / maxTF) * (this.idf[term] || 0);
            });
            return vector;
        }

        cosineSimilarity(vecA, vecB) {
            let dotProduct = 0;
            let magA = 0;
            let magB = 0;

            const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
            allTerms.forEach(term => {
                const a = vecA[term] || 0;
                const b = vecB[term] || 0;
                dotProduct += a * b;
                magA += a * a;
                magB += b * b;
            });

            if (magA === 0 || magB === 0) return 0;
            return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
        }

        search(query, topK = 5) {
            const queryTokens = this.tokenize(query);
            if (queryTokens.length === 0) return [];

            const queryVector = this.computeTFIDF(queryTokens);

            const results = this.tfidfVectors.map((docVector, idx) => ({
                faq: this.documents[idx].faq,
                score: this.cosineSimilarity(queryVector, docVector),
                index: idx
            }));

            // Also add keyword bonus for exact phrase matches
            results.forEach(r => {
                const qClean = removeVietnameseTones(r.faq.question.toLowerCase());
                const queryClean = removeVietnameseTones(query.toLowerCase());

                // Bonus for substring match in question
                if (qClean.includes(queryClean) || queryClean.includes(qClean)) {
                    r.score += 0.3;
                }

                // Bonus for matching important keywords
                queryTokens.forEach(token => {
                    if (token.length >= 3 && qClean.includes(token)) {
                        r.score += 0.05;
                    }
                });
            });

            return results
                .filter(r => r.score > 0.05)
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);
        }
    }

    const searchEngine = new TFIDFSearch();

    // Load FAQs from tcb_faq.json (full dataset)
    fetch("tcb_faq.json")
        .then(response => response.json())
        .then(data => {
            faqDatabase = data;
            console.log("✅ FAQ Database loaded:", faqDatabase.length, "items.");

            // Build TF-IDF search index
            searchEngine.buildIndex(faqDatabase);
            console.log("✅ TF-IDF Search Index built with", searchEngine.vocabulary.size, "unique terms.");

            // Populate stats in external panel
            const faqCountEl = document.getElementById("faq-count");
            if (faqCountEl) {
                faqCountEl.textContent = faqDatabase.length;
            }

            // Generate dynamic suggestion chips from categories
            generateSuggestionChips();
        })
        .catch(err => {
            console.error("Error loading tcb_faq.json, falling back to faqs.json:", err);
            // Fallback to small faqs.json
            fetch("faqs.json")
                .then(r => r.json())
                .then(data => {
                    faqDatabase = data;
                    searchEngine.buildIndex(faqDatabase);
                    const faqCountEl = document.getElementById("faq-count");
                    if (faqCountEl) faqCountEl.textContent = faqDatabase.length;
                    generateSuggestionChips();
                })
                .catch(e => console.error("All FAQ sources failed:", e));
        });

    // Generate dynamic suggestion chips from actual FAQ data
    function generateSuggestionChips() {
        const popularQuestions = [
            "Cách cập nhật sinh trắc học?",
            "Mất thẻ phải làm sao?",
            "Quên PIN thẻ phải làm gì?",
            "Phí chuyển tiền là bao nhiêu?",
            "Hạn mức chuyển khoản?",
            "Mở tài khoản cần gì?",
            "Lãi suất vay mua nhà?",
            "Cách đăng ký E-Banking?"
        ];

        suggestionsList.innerHTML = '';
        popularQuestions.forEach(q => {
            const chip = document.createElement('div');
            chip.className = 'suggestion-chip';
            chip.textContent = q;
            suggestionsList.appendChild(chip);
        });
    }

    // Toggle Chat View
    chatTrigger.addEventListener("click", () => {
        chatView.classList.add("active");
        chatTrigger.style.transform = "scale(0)";

        // Send initial greeting if chat is empty
        if (chatMessages.children.length <= 0) {
            setTimeout(() => {
                const categoryCount = [...new Set(faqDatabase.map(f => f.category))].length;
                addBotMessage(
                    `Xin chào quý khách! 👋 Tôi là **Trợ lý Ảo Techcombank**, sẵn sàng hỗ trợ giải đáp mọi thắc mắc.\n\n` +
                    `📊 Hiện tại tôi có thể tra cứu **${faqDatabase.length} câu hỏi** thuộc **${categoryCount} chủ đề** khác nhau bao gồm: Chi tiêu & Thẻ, Vay mượn, Tiết kiệm, Bảo hiểm, Tài khoản thanh toán và nhiều hơn nữa.\n\n` +
                    `Bạn có thể gõ câu hỏi hoặc chọn gợi ý bên dưới để bắt đầu! 💬`
                );
            }, 500);
        }
    });

    closeChat.addEventListener("click", () => {
        chatView.classList.remove("active");
        chatTrigger.style.transform = "scale(1)";
    });

    // Sidebar & Help/Support Toggle Triggers
    const menuBtn = document.querySelector(".menu-btn-circle");
    const sidebarBackdrop = document.querySelector(".sidebar-backdrop");
    const sidebarView = document.querySelector(".sidebar-view");
    const closeSidebar = document.querySelector(".close-sidebar");
    const helpSupportLink = document.querySelector(".help-support-link-btn");
    const helpSupportView = document.querySelector(".help-support-view");
    const backBtnHelp = document.querySelector(".back-btn-help");

    // Open Sidebar
    if (menuBtn) {
        menuBtn.addEventListener("click", () => {
            sidebarView.classList.add("active");
            sidebarBackdrop.classList.add("active");
        });
    }

    // Close Sidebar
    const hideSidebar = () => {
        sidebarView.classList.remove("active");
        sidebarBackdrop.classList.remove("active");
    };

    if (closeSidebar) closeSidebar.addEventListener("click", hideSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", hideSidebar);

    // Open Help & Support
    if (helpSupportLink) {
        helpSupportLink.addEventListener("click", (e) => {
            e.preventDefault();
            helpSupportView.classList.add("active");
        });
    }

    // Close Help & Support (Back to Sidebar)
    if (backBtnHelp) {
        backBtnHelp.addEventListener("click", () => {
            helpSupportView.classList.remove("active");
        });
    }

    // Suggested Chips Clicks
    suggestionsList.addEventListener("click", (e) => {
        if (e.target.classList.contains("suggestion-chip")) {
            const queryText = e.target.textContent;
            addUserMessage(queryText);
            processQuery(queryText);
        }
    });

    // Send Message Actions
    sendBtn.addEventListener("click", () => {
        sendMessage();
    });

    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });

    function sendMessage() {
        const queryText = chatInput.value.trim();
        if (!queryText) return;

        addUserMessage(queryText);
        chatInput.value = "";

        processQuery(queryText);
    }

    // Add User Message to bubble list
    function addUserMessage(text) {
        const timeStr = getCurrentTime();
        const msgHtml = `
            <div class="message user">
                <div class="msg-bubble">${escapeHtml(text)}</div>
                <div class="msg-time">${timeStr}</div>
            </div>
        `;
        chatMessages.insertAdjacentHTML("beforeend", msgHtml);
        scrollToBottom();
    }

    // Add Bot Message with typing animation (for greeting and fallback UI)
    function addBotMessage(text, isEmergency = false, customHtml = "") {
        const timeStr = getCurrentTime();
        const botMsgId = "bot-msg-" + Date.now();

        const msgHtml = `
            <div class="message bot" id="${botMsgId}">
                <div class="msg-bubble ${isEmergency ? 'emergency-alert' : ''}">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
                <div class="msg-time">${timeStr}</div>
            </div>
        `;
        chatMessages.insertAdjacentHTML("beforeend", msgHtml);
        scrollToBottom();

        // Simulate thinking and then type out the answer
        setTimeout(() => {
            const botMessageEl = document.getElementById(botMsgId);
            if (!botMessageEl) return;
            const bubbleEl = botMessageEl.querySelector(".msg-bubble");

            // Format bold markdown-like notation to HTML strong tags
            let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            // Format newlines
            formattedText = formattedText.replace(/\n/g, '<br>');

            bubbleEl.innerHTML = ""; // Clear indicator

            if (isEmergency) {
                bubbleEl.innerHTML = formattedText;
            } else {
                bubbleEl.innerHTML = formattedText;

                if (customHtml) {
                    bubbleEl.insertAdjacentHTML("beforeend", customHtml);
                }
            }
            scrollToBottom();
        }, 800 + Math.random() * 500);
    }

    // ===== ReAct System Prompt & Settings =====
    const SYSTEM_PROMPT = `Bạn là Trợ lý Ảo Techcombank, đang trò chuyện với khách hàng.
Bạn phải sử dụng mô hình ReAct (Reasoning + Acting) để suy luận và giải quyết yêu cầu của khách hàng.
Tại mỗi lượt, bạn chỉ được phép phản hồi theo một trong hai định dạng sau (đảm bảo viết đúng định dạng):

Định dạng 1 (Nếu cần sử dụng công cụ để tìm thêm thông tin):
Thought: [suy nghĩ của bạn bằng tiếng Việt về việc cần làm]
Action: [tên_tool]("[tham số]")

Định dạng 2 (Nếu đã có đủ thông tin và sẵn sàng trả lời khách hàng):
Thought: [suy nghĩ của bạn bằng tiếng Việt]
Final Answer: [câu trả lời đầy đủ, chi tiết, thân thiện và chuyên nghiệp bằng tiếng Việt gửi cho khách hàng]

Danh sách các công cụ (Tools) bạn có thể sử dụng:
1. search_faq("truy vấn"): Tìm kiếm câu trả lời trong cơ sở tri thức FAQ của Techcombank bằng thuật toán TF-IDF. Luôn ưu tiên dùng công cụ này đầu tiên nếu câu hỏi liên quan đến chính sách, biểu phí, thẻ, tài khoản, dịch vụ ngân hàng.
2. search_web("truy vấn"): Tra cứu thông tin trên trang web Techcombank.com (trả về các liên kết chính thức). Sử dụng khi search_faq không tìm thấy thông tin phù hợp hoặc bạn cần thông tin mở rộng.
3. escalate_to_agent("lý do"): Chuyển kết nối tới hỗ trợ viên (người thật). Chỉ dùng khi câu hỏi quá phức tạp, khách hàng yêu cầu trực tiếp gặp người thật, hoặc các công cụ tìm kiếm trên không giải quyết được vấn đề.
4. lock_card(""): Kích hoạt quy trình khóa thẻ khẩn cấp Visa Debit ****8742 của khách hàng GIANG THANH CONG. Sử dụng công cụ này ngay lập tức khi khách hàng yêu cầu khóa thẻ hoặc báo mất thẻ.

Lưu ý quan trọng:
- Bạn phải thực hiện từng bước một. Không tự tạo ra kết quả của công cụ (Observation). Sau khi bạn đưa ra 'Action', hệ thống sẽ thực hiện công cụ đó và gửi lại cho bạn 'Observation: [kết quả]'.
- Luôn giữ thái độ lịch sự, xưng hô "Techcombank" và "Quý khách".`;

    // ===== Core AI Response matching logic =====
    function processQuery(query) {
        // Normalizing search input
        const cleanQuery = removeVietnameseTones(query.toLowerCase());

        // 1. Check for Emergency Security Keywords
        const emergencyKeywords = ["hack", "bi lua", "lua dao", "mat tien", "mat acc", "lo otp", "lo mat khau", "bi danh cap", "trom tien", "chiem doat"];
        const hasEmergency = emergencyKeywords.some(keyword => cleanQuery.includes(keyword));

        if (hasEmergency) {
            const emergencyText = `
                <div class="emergency-title">⚠️ CẢNH BÁO BẢO MẬT KHẨN CẤP</div>
                <div class="emergency-desc">Hệ thống phát hiện tài khoản của bạn đang có dấu hiệu bị đe dọa bảo mật hoặc lừa đảo mất tiền. 
                Vui lòng <strong>KHÔNG</strong> chia sẻ OTP, mật khẩu cho bất kỳ ai. Để bảo vệ tài sản, bạn nên liên hệ khẩn cấp tổng đài hỗ trợ 24/7 để khóa tạm thời tài khoản/thẻ ngay lập tức.</div>
                <a href="tel:1800588822" class="emergency-btn">📞 Gọi Ngay Tổng Đài: 1800 588 822 (Miễn Phí)</a>
            `;
            addBotMessage(emergencyText, true);
            return;
        }

        // 2. Card lock confirmation (works in both bot and agent mode)
        if (pendingCardLock) {
            const confirmKeywords = ["co", "dong y", "xac nhan", "ok", "yes"];
            const cancelKeywords = ["khong", "huy", "thoi", "cancel"];

            if (confirmKeywords.some(k => cleanQuery.includes(k))) {
                showFaceIDOverlay();
                return;
            } else if (cancelKeywords.some(k => cleanQuery.includes(k))) {
                pendingCardLock = false;
                addBotMessage("Dạ, tôi đã hủy yêu cầu khóa thẻ. Quý khách có cần hỗ trợ gì thêm không ạ?");
                return;
            }
        }

        // 2.5. Card lock request check (Fallback when API key is not configured)
        const apiKey = getApiKey();
        if (!apiKey) {
            const cardLockKeywords = ["khoa the", "lock card", "mat the", "khoa tai khoan", "can khoa"];
            const unlockExclusions = ["mo", "unlock", "kich hoat", "khoi phuc"];
            const isLockRequest = cardLockKeywords.some(k => cleanQuery.includes(k)) && 
                                  !unlockExclusions.some(w => cleanQuery.includes(w));
            if (isLockRequest) {
                simulateAgentCardLockFlow();
                return;
            }
        }

        // 3. If Agent is connected, bypass bot
        if (isAgentConnected) {
            simulateAgentResponse();
            return;
        }

        // 4. Check for API key to decide between ReAct Agent or local TF-IDF fallback
        if (apiKey) {
            runReActAgent(query);
        } else {
            runLocalSearchFallback(query);
        }
    }

    // ===== Fallback to Local Search (Original TF-IDF Engine) =====
    function runLocalSearchFallback(query) {
        const results = searchEngine.search(query, 5);

        if (results.length > 0 && results[0].score >= 0.1) {
            const bestResult = results[0];
            const confidence = Math.min(Math.round(bestResult.score * 100), 99);
            const confidenceLevel = confidence >= 60 ? 'high' : confidence >= 30 ? 'medium' : 'low';
            const confidenceEmoji = confidence >= 60 ? '🟢' : confidence >= 30 ? '🟡' : '🔴';

            let answerText = bestResult.faq.answer;
            answerText = answerText.replace(/\n\s*\n/g, '\n').trim();

            const metaHtml = `
                <div class="answer-meta">
                    <span class="confidence-badge confidence-${confidenceLevel}">
                        ${confidenceEmoji} Độ tin cậy: ${confidence}%
                    </span>
                </div>
            `;

            let relatedHtml = '';
            const relatedResults = results.slice(1, 4).filter(r => r.score > 0.08);
            if (relatedResults.length > 0) {
                relatedHtml = `<div class="related-questions">
                    <div class="related-title">📌 Câu hỏi liên quan:</div>`;
                relatedResults.forEach(r => {
                    const shortQ = r.faq.question.length > 65
                        ? r.faq.question.substring(0, 65) + '...'
                        : r.faq.question;
                    relatedHtml += `<div class="related-chip" onclick="window.askRelatedQuestion('${escapeHtml(r.faq.question).replace(/'/g, "\\'")}')">${shortQ}</div>`;
                });
                relatedHtml += `</div>`;
            }

            let supportBtn = '';
            if (confidence < 40) {
                supportBtn = `
                    <div style="margin-top:8px;">
                        <button class="transfer-btn" onclick="window.connectToAgent()">💬 Kết nối hỗ trợ viên</button>
                    </div>
                `;
            }

            addBotMessage(answerText, false, metaHtml + relatedHtml + supportBtn);
        } else {
            const fallbackText = "Tôi chưa tìm thấy câu trả lời chính xác cho câu hỏi này trong cơ sở tri thức hiện hành. Quý khách có muốn kết nối với **Nhân viên hỗ trợ khách hàng trực tuyến 24/7** để được giải đáp trực tiếp không?";
            const customButtons = `
                <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="transfer-btn" onclick="window.connectToAgent()">💬 Kết nối hỗ trợ viên</button>
                    <a href="tel:1800588822" class="transfer-btn" style="text-decoration:none; display:inline-flex; align-items:center;">📞 Gọi 1800 588 822</a>
                </div>
            `;
            addBotMessage(fallbackText, false, customButtons);
        }
    }

    // ===== ReAct Intelligent Agent Loop =====
    async function runReActAgent(query) {
        let loopCount = 0;
        const maxLoops = 4;
        let agentMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query }
        ];

        // Create empty bot message bubble with Reasoning Logs inside
        const botMsgId = createBotMessageShell();

        while (loopCount < maxLoops) {
            loopCount++;
            showToolIndicator(`Đang suy nghĩ (Vòng ${loopCount})...`);

            let isFinalAnswer = false;
            let finalAnswerStarted = false;
            let accumulatedText = "";

            try {
                await callOpenAIStream(agentMessages, (chunk, fullText) => {
                    accumulatedText = fullText;

                    // Check if we hit "Final Answer:" in the stream
                    if (!finalAnswerStarted) {
                        const finalAnswerIdx = fullText.indexOf("Final Answer:");
                        if (finalAnswerIdx !== -1) {
                            finalAnswerStarted = true;
                            isFinalAnswer = true;
                            hideToolIndicator();
                            collapseReasoningLog(botMsgId);
                            clearTypingIndicator(botMsgId);

                            const initialText = fullText.substring(finalAnswerIdx + "Final Answer:".length);
                            updateFinalAnswerText(botMsgId, initialText);
                        }
                    } else {
                        const finalAnswerIdx = fullText.indexOf("Final Answer:");
                        const currentText = fullText.substring(finalAnswerIdx + "Final Answer:".length);
                        updateFinalAnswerText(botMsgId, currentText);
                    }
                });

                hideToolIndicator();

                const parsed = parseReActResponse(accumulatedText);

                if (parsed.thought) {
                    updateThoughtStep(botMsgId, parsed.thought);
                }

                if (parsed.action) {
                    appendActionStep(botMsgId, parsed.action.name, parsed.action.arg);

                    let observation = "";
                    showToolIndicator(`Đang chạy: ${parsed.action.name}...`);

                    if (parsed.action.name === "search_faq") {
                        observation = runSearchFAQ(parsed.action.arg);
                    } else if (parsed.action.name === "search_web") {
                        observation = runSearchWeb(parsed.action.arg);
                    } else if (parsed.action.name === "escalate_to_agent") {
                        observation = runEscalateToAgent(parsed.action.arg, botMsgId);
                        appendObservationStep(botMsgId, observation);
                        break;
                    } else if (parsed.action.name === "lock_card") {
                        observation = runLockCard();
                        appendObservationStep(botMsgId, observation);
                        break;
                    } else {
                        observation = `Lỗi: Không tìm thấy công cụ "${parsed.action.name}".`;
                    }

                    appendObservationStep(botMsgId, observation);

                    agentMessages.push({ role: "assistant", content: accumulatedText });
                    agentMessages.push({ role: "user", content: `Observation: ${observation}` });

                } else {
                    if (!isFinalAnswer) {
                        clearTypingIndicator(botMsgId);
                        updateFinalAnswerText(botMsgId, accumulatedText);
                    }
                    removeStreamingCursor(botMsgId);

                    // Add related questions/metadata to bottom of bubble
                    addRelatedQuestionsMetadata(botMsgId, query);
                    break;
                }

            } catch (err) {
                console.error("Error in ReAct loop:", err);
                hideToolIndicator();
                clearTypingIndicator(botMsgId);

                const textContent = document.querySelector(`#${botMsgId} .msg-text-content`);
                if (textContent) {
                    textContent.innerHTML = `<span style="color:#ff4757;">⚠️ Lỗi API: ${escapeHtml(err.message)}</span><br><br>Đang tự động chuyển về chế độ tra cứu local...`;
                }

                setTimeout(() => {
                    const errBubble = document.getElementById(botMsgId);
                    if (errBubble) errBubble.remove();
                    runLocalSearchFallback(query);
                }, 2000);

                return;
            }
        }
    }

    // ===== ReAct UI Update Helpers =====
    function createBotMessageShell() {
        const timeStr = getCurrentTime();
        const botMsgId = "bot-msg-" + Date.now();

        const msgHtml = `
            <div class="message bot" id="${botMsgId}">
                <div class="msg-bubble">
                    <div class="react-steps-container">
                        <div class="react-steps-header" onclick="window.toggleReactSteps(this)">
                            <span>🛠️ Nhật ký suy luận của Agent</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </div>
                        <div class="react-steps-body" style="display: flex;">
                            <div class="react-steps-progress-info" style="font-size: 10px; color: #888888; font-style: italic;">Đang khởi tạo suy luận...</div>
                        </div>
                    </div>
                    <div class="msg-text-content">
                        <div class="typing-indicator">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                </div>
                <div class="msg-time">${timeStr}</div>
            </div>
        `;
        chatMessages.insertAdjacentHTML("beforeend", msgHtml);
        scrollToBottom();
        return botMsgId;
    }

    window.toggleReactSteps = function (headerEl) {
        const body = headerEl.nextElementSibling;
        const icon = headerEl.querySelector("i");
        if (body.style.display === "none") {
            body.style.display = "flex";
            icon.className = "fa-solid fa-chevron-down";
        } else {
            body.style.display = "none";
            icon.className = "fa-solid fa-chevron-right";
        }
        scrollToBottom();
    };

    function updateThoughtStep(botMsgId, thought) {
        const body = document.querySelector(`#${botMsgId} .react-steps-body`);
        if (!body) return;

        const placeholder = body.querySelector(".react-steps-progress-info");
        if (placeholder) placeholder.remove();

        let thoughtEl = body.querySelector(".react-step-thought");
        if (!thoughtEl) {
            thoughtEl = document.createElement("div");
            thoughtEl.className = "react-step react-step-thought";
            body.appendChild(thoughtEl);
        }
        thoughtEl.innerHTML = `<strong>Thought:</strong> ${escapeHtml(thought)}`;
        scrollToBottom();
    }

    function appendActionStep(botMsgId, name, arg) {
        const body = document.querySelector(`#${botMsgId} .react-steps-body`);
        if (!body) return;

        const actionEl = document.createElement("div");
        actionEl.className = "react-step react-step-action";
        actionEl.innerHTML = `<strong>Action:</strong> Gọi công cụ <code>${escapeHtml(name)}</code> với tham số <code>"${escapeHtml(arg)}"</code>`;
        body.appendChild(actionEl);
        scrollToBottom();
    }

    function appendObservationStep(botMsgId, obs) {
        const body = document.querySelector(`#${botMsgId} .react-steps-body`);
        if (!body) return;

        const obsEl = document.createElement("div");
        obsEl.className = "react-step react-step-observation";
        obsEl.innerHTML = `<strong>Observation:</strong><br>${escapeHtml(obs)}`;
        body.appendChild(obsEl);
        scrollToBottom();
    }

    function collapseReasoningLog(botMsgId) {
        const body = document.querySelector(`#${botMsgId} .react-steps-body`);
        const headerIcon = document.querySelector(`#${botMsgId} .react-steps-header i`);
        if (body) body.style.display = "none";
        if (headerIcon) headerIcon.className = "fa-solid fa-chevron-right";
    }

    function clearTypingIndicator(botMsgId) {
        const textContent = document.querySelector(`#${botMsgId} .msg-text-content`);
        if (textContent) textContent.innerHTML = "";
    }

    function updateFinalAnswerText(botMsgId, text) {
        const textContent = document.querySelector(`#${botMsgId} .msg-text-content`);
        if (!textContent) return;

        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\n/g, '<br>');
        textContent.innerHTML = formattedText + `<span class="streaming-cursor"></span>`;
        scrollToBottom();
    }

    function removeStreamingCursor(botMsgId) {
        const cursor = document.querySelector(`#${botMsgId} .streaming-cursor`);
        if (cursor) cursor.remove();
    }

    // ===== ReAct Tool Implementations =====
    function runSearchFAQ(query) {
        const results = searchEngine.search(query, 3);
        if (results.length === 0) {
            return "Không tìm thấy thông tin nào phù hợp trong FAQ.";
        }
        return results.map(r => `[FAQ] Câu hỏi: ${r.faq.question}\nTrả lời: ${r.faq.answer}\nCategory: ${r.faq.category}\nScore: ${r.score}`).join("\n\n");
    }

    function runSearchWeb(query) {
        const results = searchEngine.search(query, 2);
        const links = {
            "the": "https://techcombank.com/khach-hang-ca-nhan/the",
            "tiet kiem": "https://techcombank.com/khach-hang-ca-nhan/tiet-kiem",
            "vay": "https://techcombank.com/khach-hang-ca-nhan/vay",
            "tai khoan": "https://techcombank.com/khach-hang-ca-nhan/tai-khoan",
            "sinh trac hoc": "https://techcombank.com/thong-bao-huong-dan-cap-nhat-sinh-trac-hoc",
            "chuyen tien": "https://techcombank.com/bieu-phi-dich-vu-chuyen-tien"
        };

        let matchedLinks = [];
        const cleanQuery = removeVietnameseTones(query.toLowerCase());
        for (const [key, value] of Object.entries(links)) {
            if (cleanQuery.includes(key)) {
                matchedLinks.push(`- Liên kết hữu ích: [Xem thông tin về ${key}](${value})`);
            }
        }

        let obs = `Kết quả tìm kiếm web cho "${query}":\n`;
        if (matchedLinks.length > 0) {
            obs += matchedLinks.join("\n") + "\n";
        } else {
            obs += `- Liên kết tham khảo: [Trang chủ Techcombank](https://techcombank.com)\n`;
        }

        if (results.length > 0) {
            obs += `Dữ liệu liên quan tìm được trên trang tin:\n` + results.map(r => `- ${r.faq.question}: ${r.faq.answer.substring(0, 150)}...`).join("\n");
        }
        return obs;
    }

    function runEscalateToAgent(reason, botMsgId) {
        setTimeout(() => {
            clearTypingIndicator(botMsgId);
            const fallbackText = `Tôi chưa tìm thấy câu trả lời chính xác cho thắc mắc này trong cơ sở tri thức hiện tại. Quý khách có muốn kết nối với <strong>Nhân viên hỗ trợ trực tuyến 24/7</strong> để được giải đáp trực tiếp không?`;
            const customButtons = `
                <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; animation: fade-in 0.3s ease-out;">
                    <button class="transfer-btn" onclick="window.connectToAgent()">💬 Kết nối hỗ trợ viên</button>
                </div>
            `;
            const textContent = document.querySelector(`#${botMsgId} .msg-text-content`);
            if (textContent) {
                textContent.innerHTML = fallbackText + customButtons;
            }
            scrollToBottom();
        }, 500);
        return `Đang hiển thị hộp thoại hỏi ý kiến người dùng về việc kết nối hỗ trợ viên. Lý do: ${reason}`;
    }

    function runLockCard() {
        simulateAgentCardLockFlow();
        return "Đã hiển thị bảng xác thực và yêu cầu xác nhận khóa thẻ Visa Debit ****8742 của khách hàng GIANG THANH CONG.";
    }

    async function callOpenAIStream(messages, onChunk) {
        const apiKey = getApiKey();
        const model = getModel();

        // Determine if it is Mistral or OpenAI based on API Key prefix or model name
        let url = "https://api.openai.com/v1/chat/completions";
        const isMistral = !apiKey.startsWith("sk-") || model.includes("mistral") || model.includes("codestral");
        if (isMistral) {
            url = "https://api.mistral.ai/v1/chat/completions";
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || "API call failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullText = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // Keep the last partial line

            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine) continue;
                if (cleanLine === "data: [DONE]") continue;
                if (cleanLine.startsWith("data: ")) {
                    try {
                        const parsed = JSON.parse(cleanLine.substring(6));
                        const content = parsed.choices[0]?.delta?.content || "";
                        if (content) {
                            fullText += content;
                            onChunk(content, fullText);
                        }
                    } catch (e) {
                        console.error("Error parsing stream line:", e);
                    }
                }
            }
        }

        return fullText;
    }

    function parseReActResponse(text) {
        const thoughtMatch = text.match(/Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i);
        const actionMatch = text.match(/Action:\s*(\w+)\((["']?)([\s\S]*?)\2\)/i);
        const finalAnswerMatch = text.match(/Final Answer:\s*([\s\S]*)/i);

        return {
            thought: thoughtMatch ? thoughtMatch[1].trim() : null,
            action: actionMatch ? { name: actionMatch[1].trim(), arg: actionMatch[3].trim() } : null,
            finalAnswer: finalAnswerMatch ? finalAnswerMatch[1].trim() : null
        };
    }

    // ===== Metadata & Related Questions UI generator =====
    function addRelatedQuestionsMetadata(botMsgId, query) {
        const results = searchEngine.search(query, 5);
        if (results.length === 0) return;

        const bestResult = results[0];
        const confidence = Math.min(Math.round(bestResult.score * 100), 99);
        const confidenceLevel = confidence >= 60 ? 'high' : confidence >= 30 ? 'medium' : 'low';
        const confidenceEmoji = confidence >= 60 ? '🟢' : confidence >= 30 ? '🟡' : '🔴';

        const metaHtml = `
            <div class="answer-meta" style="animation: fade-in 0.3s ease-out;">
                <span class="confidence-badge confidence-${confidenceLevel}">
                    ${confidenceEmoji} Độ tin cậy: ${confidence}%
                </span>
            </div>
        `;

        let relatedHtml = '';
        const relatedResults = results.slice(1, 4).filter(r => r.score > 0.08);
        if (relatedResults.length > 0) {
            relatedHtml = `<div class="related-questions" style="animation: fade-in 0.3s ease-out;">
                <div class="related-title">📌 Câu hỏi liên quan:</div>`;
            relatedResults.forEach(r => {
                const shortQ = r.faq.question.length > 65
                    ? r.faq.question.substring(0, 65) + '...'
                    : r.faq.question;
                relatedHtml += `<div class="related-chip" onclick="window.askRelatedQuestion('${escapeHtml(r.faq.question).replace(/'/g, "\\'")}')">${shortQ}</div>`;
            });
            relatedHtml += `</div>`;
        }

        let supportBtn = '';
        if (confidence < 40) {
            supportBtn = `
                <div style="margin-top:8px; animation: fade-in 0.3s ease-out;">
                    <button class="transfer-btn" onclick="window.connectToAgent()">💬 Kết nối hỗ trợ viên</button>
                </div>
            `;
        }

        const bubbleEl = document.querySelector(`#${botMsgId} .msg-bubble`);
        if (bubbleEl) {
            bubbleEl.insertAdjacentHTML("beforeend", metaHtml + relatedHtml + supportBtn);
        }
        scrollToBottom();
    }

    // ===== Related Questions Handlers =====
    window.askRelatedQuestion = function (question) {
        addUserMessage(question);
        processQuery(question);
    };

    // ===== Mock human support agent takeover =====
    window.connectToAgent = function () {
        // Mock Error Case: Agent Busy on first attempt
        if (agentBusyMode) {
            agentBusyMode = false; // Next attempt will succeed

            const timeStr = getCurrentTime();
            const busyHtml = `
                <div class="message bot">
                    <div class="msg-bubble">
                        <div class="agent-busy-alert">
                            <div class="agent-busy-icon">⏳</div>
                            <div class="agent-busy-title">Tổng đài viên đang bận</div>
                            <div class="agent-busy-desc">Rất tiếc, hiện tại <strong>tất cả các Tổng đài viên</strong> đều đang bận phục vụ khách hàng khác.</div>
                            <div class="agent-busy-question">Quý khách có muốn tôi hỗ trợ tra cứu thông tin khác không?</div>
                            <div class="agent-busy-buttons">
                                <button class="agent-busy-btn agent-busy-btn-yes" onclick="window.handleAgentBusyChoice('yes')">✅ Có, tôi muốn hỏi câu khác</button>
                                <button class="agent-busy-btn agent-busy-btn-no" onclick="window.handleAgentBusyChoice('no')">⏰ Không, tôi sẽ đợi</button>
                            </div>
                        </div>
                    </div>
                    <div class="msg-time">${timeStr}</div>
                </div>
            `;
            chatMessages.insertAdjacentHTML("beforeend", busyHtml);
            scrollToBottom();
            return;
        }

        // Success case: connect to agent
        isAgentConnected = true;

        const botName = document.querySelector(".bot-info h3");
        const botStatus = document.querySelector(".bot-info p");
        const botAvatar = document.querySelector(".bot-avatar");

        if (botName) botName.textContent = "Hỗ Trợ Viên: Thu Trang";
        if (botStatus) {
            botStatus.textContent = "Đang trực tuyến";
            botStatus.style.color = "#4cd137";
        }
        if (botAvatar) {
            botAvatar.style.background = "linear-gradient(135deg, #10ac84, #1dd1a1)";
            botAvatar.innerHTML = "💬<div class='active-dot'></div>";
        }

        const transferAlert = `
            <div class="agent-transfer-alert">
                <i class="fa-solid fa-user-headset" style="margin-right:6px;"></i>
                Hệ thống đã chuyển kết nối đến Điện thoại viên Nguyễn Thu Trang.
            </div>
        `;
        chatMessages.insertAdjacentHTML("beforeend", transferAlert);
        scrollToBottom();

        setTimeout(() => {
            addBotMessage("Xin chào quý khách! Tôi là Nguyễn Thu Trang, hỗ trợ viên trực tuyến của Techcombank. Tôi đã đọc lịch sử trò chuyện của bạn. Tôi có thể hỗ trợ gì thêm cho bạn về thắc mắc tra cứu này?");
        }, 1200);
    };

    function simulateAgentResponse() {
        const agentAnswers = [
            "Techcombank hiện tại đang áp dụng chính sách ưu đãi không mất phí quản lý tài khoản và phí giao dịch trực tuyến trên ứng dụng Techcombank Mobile ạ. Quý khách có thắc mắc thêm về biểu phí thẻ tín dụng không?",
            "Dạ, đối với thắc mắc này của quý khách, ngoài việc xem online, quý khách cũng có thể liên hệ số hotline 1800-588822 bất cứ lúc nào, các bạn tổng đài viên chuyên trách sẽ tra cứu chi tiết số dư và biểu phí giao dịch cụ thể của riêng tài khoản quý khách nhé ạ.",
            "Tôi có thể hỗ trợ kiểm tra thêm thông tin dịch vụ này giúp quý khách. Quý khách có thể cho tôi xin tên đầy đủ để tiện xưng hô không ạ?"
        ];

        const randomAnswer = agentAnswers[Math.floor(Math.random() * agentAnswers.length)];
        setTimeout(() => {
            addBotMessage(randomAnswer);
        }, 1000);
    }

    // ===== Agent Busy Choice Handler =====
    window.handleAgentBusyChoice = function(choice) {
        // Disable all busy buttons after clicking
        document.querySelectorAll('.agent-busy-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.pointerEvents = 'none';
        });

        if (choice === 'yes') {
            addBotMessage("Dạ được ạ! Quý khách cứ thoải mái đặt câu hỏi, tôi sẽ hỗ trợ tra cứu ngay. 😊");
        } else {
            addBotMessage(
                "Cảm ơn quý khách đã kiên nhẫn! 🙏\n\n" +
                "Vui lòng thử nhấn nút **[Kết nối hỗ trợ viên]** lại dưới đây. Chúng tôi sẽ kết nối quý khách với tổng đài viên sớm nhất có thể.\n\n" +
                "Trong lúc chờ đợi, quý khách có thể hỏi tôi bất kỳ câu hỏi nào — tôi sẽ hỗ trợ tra cứu thông tin ngay!",
                false,
                `
                <div style="margin-top:10px;">
                    <button class="transfer-btn" onclick="window.connectToAgent()">💬 Kết nối hỗ trợ viên</button>
                </div>
                `
            );
        }
    };

    // ===== Card Lock Flow via Agent =====
    function simulateAgentCardLockFlow() {
        pendingCardLock = true;
        setTimeout(() => {
            addBotMessage(
                "Dạ, tôi hiểu quý khách muốn **khóa thẻ** để bảo vệ tài sản. Để tiến hành, tôi cần quý khách xác nhận thông tin:\n\n" +
                "💳 Thẻ: **Visa Debit ****8742**\n" +
                "👤 Chủ thẻ: **GIANG THANH CONG**\n\n" +
                "Vui lòng gõ **'Đồng ý'** để khóa thẻ ngay lập tức, hoặc **'Hủy'** để hủy yêu cầu."
            );
        }, 1000);
    }


    // ===== Face ID Verification Overlay =====
    function showFaceIDOverlay() {
        const overlay = document.getElementById('faceIDOverlay');
        const statusText = document.getElementById('faceIDStatus');
        const scanRing = document.getElementById('faceIDScanRing');
        const faceIcon = document.getElementById('faceIDIcon');
        const subtitle = document.getElementById('faceIDSubtitle');

        if (!overlay) return;

        faceIDAttempt++;

        // Reset state
        overlay.style.display = 'flex';
        statusText.textContent = 'Đang quét Face ID...';
        statusText.style.color = '#ffffff';
        scanRing.className = 'faceid-scan-ring scanning';
        faceIcon.textContent = '🙂';
        if (subtitle) {
            subtitle.textContent = 'Vui lòng nhìn thẳng vào camera';
            subtitle.style.color = 'rgba(255, 255, 255, 0.5)';
        }

        // Hide retry button if exists
        const retryBtn = document.getElementById('faceIDRetryBtn');
        if (retryBtn) retryBtn.style.display = 'none';

        // Phase 1: Scanning
        setTimeout(() => {
            statusText.textContent = 'Đang xác minh danh tính...';
        }, 1200);

        if (faceIDAttempt === 1) {
            // FAIL on first attempt
            setTimeout(() => {
                scanRing.className = 'faceid-scan-ring failed';
                faceIcon.textContent = '❌';
                statusText.textContent = 'Không nhận diện được khuôn mặt!';
                statusText.style.color = '#ff4757';
                if (subtitle) {
                    subtitle.textContent = 'Vui lòng đảm bảo đủ ánh sáng và nhìn thẳng vào camera';
                    subtitle.style.color = 'rgba(255, 100, 100, 0.7)';
                }
                // Show retry button
                if (retryBtn) retryBtn.style.display = 'inline-block';
            }, 2500);
        } else {
            // SUCCESS on subsequent attempts
            setTimeout(() => {
                scanRing.className = 'faceid-scan-ring success';
                faceIcon.textContent = '✅';
                statusText.textContent = 'Xác minh thành công!';
                statusText.style.color = '#4cd137';
                if (subtitle) {
                    subtitle.textContent = '';
                }
            }, 2500);

            // Close overlay & show lock success
            setTimeout(() => {
                overlay.style.display = 'none';
                faceIDAttempt = 0; // Reset for future use
                showCardLockSuccess();
            }, 3500);
        }
    }

    // Retry Face ID handler
    window.retryFaceID = function() {
        showFaceIDOverlay();
    };

    function showCardLockSuccess() {
        pendingCardLock = false;
        const now = new Date();
        const timeStr = getCurrentTime();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        const successHtml = `
            <div class="message bot">
                <div class="msg-bubble">
                    <div class="card-lock-success">
                        <div class="card-lock-icon">🔒</div>
                        <div class="card-lock-title">KHÓA THẺ THÀNH CÔNG</div>
                        <div class="card-lock-details">
                            <div class="card-lock-row"><span>Thẻ:</span> <strong>Visa Debit ****8742</strong></div>
                            <div class="card-lock-row"><span>Trạng thái:</span> <strong style="color: #e74c3c;">Đã khóa tạm thời</strong></div>
                            <div class="card-lock-row"><span>Thời gian:</span> <strong>${timeStr} — ${dateStr}</strong></div>
                            <div class="card-lock-row"><span>Xác thực:</span> <strong style="color: #2e7d32;">✅ Face ID</strong></div>
                        </div>
                        <div class="card-lock-info">
                            ℹ️ Để mở khóa thẻ, quý khách có thể gọi <strong>1800 588 822</strong> hoặc đến chi nhánh Techcombank gần nhất.
                        </div>
                    </div>
                </div>
                <div class="msg-time">${timeStr}</div>
            </div>
        `;
        chatMessages.insertAdjacentHTML("beforeend", successHtml);
        scrollToBottom();

        setTimeout(() => {
            addBotMessage("Thẻ của quý khách đã được khóa an toàn sau khi xác minh Face ID. Quý khách có cần hỗ trợ gì thêm không ạ?");
        }, 1500);
    }

    // ===== UI Utility Helpers =====
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function getCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});

// Helper: Normalize Vietnamese strings for matching (global scope for TF-IDF class)
function removeVietnameseTones(str) {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}
