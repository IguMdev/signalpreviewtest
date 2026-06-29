const fs = require('fs');
let content = fs.readFileSync('index_dratania.html', 'utf-8');

const startTag = '<div class="custom-reviews">';
const endTag = '</div>\n</div>'; // Closing of custom-reviews and the parent elementor-shortcode

const startIndex = content.indexOf('<style>\n.custom-reviews {');
const endIndex = content.indexOf(endTag, startIndex) + endTag.length;

if (startIndex === -1 || endIndex < startIndex) {
    console.error("Could not find the custom block");
    process.exit(1);
}

const newBlock = `
<style>
.vertical-reviews {
    display: flex;
    flex-direction: column;
    gap: 30px;
    padding: 20px 0;
    max-width: 800px;
    margin: 0 auto;
    font-family: inherit;
    color: #fff;
}
.v-review-item {
    display: flex;
    flex-direction: column;
    text-align: left;
}
.v-published-on {
    font-size: 13px;
    color: #ddd;
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 5px;
}
.v-published-on img {
    width: 14px;
    height: 14px;
}
.v-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-bottom: 5px;
}
.v-name {
    font-weight: bold;
    font-size: 15px;
    margin: 2px 0;
}
.v-time {
    font-size: 12px;
    color: #bbb;
    margin-bottom: 5px;
}
.v-stars {
    color: #fbbc04;
    font-size: 16px;
    margin-bottom: 2px;
}
.v-trust {
    font-size: 11px;
    color: #bbb;
    margin-bottom: 8px;
}
.v-text {
    font-size: 14px;
    line-height: 1.5;
}
</style>
<div class="vertical-reviews">
    <div class="v-review-item">
        <div class="v-published-on">Publicado em <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"></div>
        <img class="v-avatar" src="https://ui-avatars.com/api/?name=Adriano+Costa&background=random&color=fff&rounded=true" alt="Adriano Costa">
        <div class="v-name">Adriano Costa</div>
        <div class="v-time">5 meses atrás</div>
        <div class="v-stars">★★★★★</div>
        <div class="v-trust">Nós verificamos a fonte original.</div>
        <div class="v-text">Excelente!</div>
    </div>
    
    <div class="v-review-item">
        <div class="v-published-on">Publicado em <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"></div>
        <img class="v-avatar" src="https://ui-avatars.com/api/?name=Vania+ICN&background=random&color=fff&rounded=true" alt="Vania ICN">
        <div class="v-name">Vania ICN</div>
        <div class="v-time">6 meses atrás</div>
        <div class="v-stars">★★★★★</div>
        <div class="v-trust">Nós verificamos a fonte original.</div>
        <div class="v-text">Sou paciente da Dra. Tânia Magalhães há muitos anos e desde sempre, até hoje, ela é extremamente profissional, cuidadosa e detalhista. Mantém seus conhecimentos atualizados, sempre ativa em congressos e estudos de novas tecnologias e soluções, além de ser uma pessoa excepcional!</div>
    </div>

    <div class="v-review-item">
        <div class="v-published-on">Publicado em <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"></div>
        <img class="v-avatar" src="https://ui-avatars.com/api/?name=Igor+Matheus&background=random&color=fff&rounded=true" alt="Igor Matheus">
        <div class="v-name">Igor Matheus</div>
        <div class="v-time">8 meses atrás</div>
        <div class="v-stars">★★★★★</div>
        <div class="v-trust">Nós verificamos a fonte original.</div>
        <div class="v-text">Melhor consultório de odontologia de Brasília na Asa Sul, atendimento ímpar!</div>
    </div>

    <div class="v-review-item">
        <div class="v-published-on">Publicado em <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"></div>
        <img class="v-avatar" src="https://ui-avatars.com/api/?name=Liana+Avalone&background=random&color=fff&rounded=true" alt="Liana Avalone">
        <div class="v-name">Liana Avalone</div>
        <div class="v-time">9 meses atrás</div>
        <div class="v-stars">★★★★★</div>
        <div class="v-trust">Nós verificamos a fonte original.</div>
        <div class="v-text">Atendimento excelente. Profissional competente. Recomendo!</div>
    </div>
</div>
</div>
`;

content = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
fs.writeFileSync('index_dratania.html', content, 'utf-8');
console.log('Layout fixed successfully');
