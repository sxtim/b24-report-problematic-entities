BX24.init(() => {
    const app = document.getElementById('app');
    let context = BX24.placement.info();

    if( context["placement"] == 'CRM_LEAD_DETAIL_TAB' ) {
        app.innerHTML = `<pre>${JSON.stringify(context, null, 2)}</pre>`;
    }
})

