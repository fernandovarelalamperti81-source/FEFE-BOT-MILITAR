-- Coloque este Script em ServerScriptService, NUNCA em StarterPlayerScripts/LocalScript.
-- Antes de publicar: substitua API_URL e LINK_SECRET e teste em um jogo privado.
-- Para produção, guarde o segredo em Roblox Secrets/HttpService:GetSecret quando disponível,
-- em vez de deixar o valor literal neste arquivo.

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local API_URL = "https://SEU-SERVICO.example.com/roblox/confirm"
local LINK_SECRET = "SUBSTITUA_PELO_MESMO_SEGREDO_DO_ENV"

local lastRequestAt = {}
local COOLDOWN_SECONDS = 5

local function handleMessage(player, message)
    local code = string.match(message, "^!vincular%s+([%w]+)%s*$")
    if not code then return end

    local now = os.clock()
    if lastRequestAt[player.UserId] and now - lastRequestAt[player.UserId] < COOLDOWN_SECONDS then
        return
    end
    lastRequestAt[player.UserId] = now

    local payload = {
        code = string.upper(code),
        robloxUserId = tostring(player.UserId),
        robloxUsername = player.Name
    }

    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = API_URL,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["x-link-secret"] = LINK_SECRET
            },
            Body = HttpService:JSONEncode(payload)
        })
    end)

    if not success then
        warn("[FEFE BOT] Falha ao contatar o serviço de vinculação.")
        return
    end

    if response.Success then
        print("[FEFE BOT] Conta Roblox vinculada para UserId " .. player.UserId)
    else
        warn("[FEFE BOT] Vinculação recusada. HTTP " .. tostring(response.StatusCode))
    end
end

Players.PlayerAdded:Connect(function(player)
    player.Chatted:Connect(function(message)
        handleMessage(player, message)
    end)
end)

for _, player in ipairs(Players:GetPlayers()) do
    player.Chatted:Connect(function(message)
        handleMessage(player, message)
    end)
end

Players.PlayerRemoving:Connect(function(player)
    lastRequestAt[player.UserId] = nil
end)
