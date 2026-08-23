(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var toggleBtn = document.getElementById('pmInviteCodeToggle');
        var input = document.getElementById('pmInviteCodeInput');
        var submitBtn = document.getElementById('pmInviteCodeSubmit');
        var message = document.getElementById('pmInviteCodeMessage');
        var inviteModal = document.getElementById('inviteCodeModal');
        var inviteModalClose = document.getElementById('inviteCodeModalClose');
        var profileModal = document.getElementById('profileModal');

        if (!toggleBtn || !input || !submitBtn || !message || !inviteModal) return;

        function showInviteMessage(text, isError) {
            message.textContent = text;
            message.classList.remove('hidden');
            message.classList.toggle('error', !!isError);
            message.classList.toggle('success', !isError);
        }

        function closeInviteModal() {
            inviteModal.classList.add('hidden');
            inviteModal.setAttribute('aria-hidden', 'true');
        }

        toggleBtn.addEventListener('click', function () {
            if (profileModal) {
                profileModal.classList.add('hidden');
                profileModal.setAttribute('aria-hidden', 'true');
            }
            inviteModal.classList.remove('hidden');
            inviteModal.setAttribute('aria-hidden', 'false');
            message.textContent = '';
            message.classList.remove('error', 'success');
            input.focus();
        });

        if (inviteModalClose) inviteModalClose.addEventListener('click', closeInviteModal);
        inviteModal.addEventListener('click', function (event) {
            if (event.target === inviteModal) closeInviteModal();
        });

        async function redeemInviteCode() {
            var code = (input.value || '').trim();
            if (!code) {
                showInviteMessage('Ingresa un código de invitación.', true);
                return;
            }

            submitBtn.disabled = true;
            showInviteMessage('Verificando tu código...', false);
            try {
                var response = await fetch(apiUrl('/api/invitation/redeem'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ code: code })
                });
                var data = await response.json().catch(function () { return {}; });
                if (!response.ok || !data.ok) {
                    showInviteMessage(data.message || 'No se pudo activar el código.', true);
                    return;
                }

                showInviteMessage(data.message, false);
                if (typeof currentPlanState !== 'undefined') {
                    currentPlanState.planId = data.plan_id;
                    currentPlanState.rawPlan = data.plan_id;
                    currentPlanState.expiresAtTs = Number(data.expires_at_ts);
                    currentPlanState.nowTs = Number(data.now_ts);
                }
                if (typeof renderPlanInProfile === 'function') renderPlanInProfile();
                if (typeof fetchUsageStatusFromBackend === 'function') await fetchUsageStatusFromBackend();
                input.value = '';
            } catch (error) {
                console.error('No se pudo canjear la invitación', error);
                showInviteMessage('No se pudo conectar con el servidor. Intenta nuevamente.', true);
            } finally {
                submitBtn.disabled = false;
            }
        }

        submitBtn.addEventListener('click', redeemInviteCode);
        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                redeemInviteCode();
            }
        });
    });
})();
