const n="vaxrebot-onboarded";function d(){let e=!1;try{e=localStorage.getItem(n)==="true"}catch{e=!1}e||r()}const i=Object.freeze([{title:"Stop the spread",body:"Each face is a person and each line is a contact the virus can travel along. Red faces are sick, and red lines show where it can jump next."},{title:"Pick a tool, then tap",body:"Choose a tool from the tray at the bottom, then tap a person or a line. Some tools open on a later day, as the briefing shows. When your actions run out, the next day starts on its own."},{title:"Win or lose",body:"You win when nobody is sick. You lose if cases reach the cap on the case meter. Sick people can die, so act early. Watch R: below 1 means the outbreak is shrinking."}]),s=(e,o)=>`
                <div class="onboarding-card">
                    <span class="onboarding-step">${o+1}</span>
                    <h3>${e.title}</h3>
                    <p>${e.body}</p>
                </div>`;function r(){const e=document.createElement("div");e.className="onboarding-overlay",e.innerHTML=`
        <div class="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            <h2 id="onboarding-title">How to play</h2>
            <p class="onboarding-intro">Three things to know before your first day.</p>
            <div class="onboarding-cards">${i.map(s).join("")}
            </div>
            <div class="onboarding-actions">
                <button class="btn btn--primary btn--lg" data-onboarding-dismiss>Start Playing</button>
            </div>
        </div>
    `;const o=()=>{try{localStorage.setItem(n,"true")}catch{}document.removeEventListener("keydown",t),e.remove()},t=a=>{a.key==="Escape"&&o()};e.querySelector("[data-onboarding-dismiss]").addEventListener("click",o),document.addEventListener("keydown",t),document.body.appendChild(e)}export{i as HOW_TO_PLAY,d as maybeShowOnboarding,r as showOnboarding};
