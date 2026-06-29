const fs = require('fs');

let content = fs.readFileSync('index_dratania.html', 'utf-8');

const startWidget = '<div class="elementor-element elementor-element-2697f09 elementor-widget elementor-widget-shortcode" data-id="2697f09" data-element_type="widget" data-widget_type="shortcode.default">';
const endWidgetSearchStart = content.indexOf(startWidget);
const nextElementStart = content.indexOf('<div class="elementor-element', endWidgetSearchStart + 100);

const oldBlock = content.substring(endWidgetSearchStart, nextElementStart);

const newBlock = `
<div class="elementor-element elementor-element-2697f09 elementor-widget elementor-widget-shortcode" data-id="2697f09" data-element_type="widget" data-widget_type="shortcode.default">
<style>
.custom-reviews {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    padding: 20px 0;
}
.custom-review-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    color: #333;
    font-family: inherit;
    text-align: left;
}
.custom-review-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
}
.custom-review-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: #eee;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: bold;
    color: #fff;
    background: linear-gradient(135deg, #a78b91, #4d3237);
}
.custom-review-info h4 {
    margin: 0;
    font-size: 16px;
    color: #222;
    font-weight: bold;
}
.custom-review-info p {
    margin: 2px 0 0 0;
    font-size: 13px;
    color: #777;
}
.custom-stars {
    color: #fbbc04;
    font-size: 18px;
    margin-bottom: 12px;
}
.custom-review-text {
    font-size: 15px;
    line-height: 1.5;
    color: #444;
}
</style>
<div class="custom-reviews">
    <div class="custom-review-card">
        <div class="custom-review-header">
            <div class="custom-review-avatar">A</div>
            <div class="custom-review-info">
                <h4>Adriano Costa</h4>
                <p>Publicado no Google</p>
            </div>
        </div>
        <div class="custom-stars">★★★★★</div>
        <div class="custom-review-text">Excelente!</div>
    </div>
    <div class="custom-review-card">
        <div class="custom-review-header">
            <div class="custom-review-avatar">V</div>
            <div class="custom-review-info">
                <h4>Vania ICN</h4>
                <p>Publicado no Google</p>
            </div>
        </div>
        <div class="custom-stars">★★★★★</div>
        <div class="custom-review-text">Sou paciente da Dra. Tânia Magalhães há muitos anos e desde sempre, até hoje, ela é extremamente profissional, cuidadosa e detalhista. Mantém seus conhecimentos atualizados, sempre ativa em congressos e estudos de novas tecnologias e soluções, além de ser uma pessoa excepcional!</div>
    </div>
    <div class="custom-review-card">
        <div class="custom-review-header">
            <div class="custom-review-avatar">I</div>
            <div class="custom-review-info">
                <h4>Igor Matheus</h4>
                <p>Publicado no Google</p>
            </div>
        </div>
        <div class="custom-stars">★★★★★</div>
        <div class="custom-review-text">Melhor consultório de odontologia de Brasília na Asa Sul, atendimento ímpar!</div>
    </div>
    <div class="custom-review-card">
        <div class="custom-review-header">
            <div class="custom-review-avatar">L</div>
            <div class="custom-review-info">
                <h4>Liana Avalone</h4>
                <p>Publicado no Google</p>
            </div>
        </div>
        <div class="custom-stars">★★★★★</div>
        <div class="custom-review-text">Atendimento excelente. Profissional competente. Recomendo!</div>
    </div>
</div>
</div>
`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('index_dratania.html', content, 'utf-8');
console.log('Replaced successfully');
