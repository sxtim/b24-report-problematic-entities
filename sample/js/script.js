BX24.install( ()=> {
    BX24.callMethod('user.current', {}, function(res){
        const url = (window.location.origin + window.location.pathname).replace(/index\.html$/, 'widget.html');

        BX24.callMethod('placement.bind', {
            PLACEMENT: "CRM_LEAD_DETAIL_TAB",
            TITLE: "Виджет24",
            HANDLER: url
        }, (result) => {
            if(result.error())
                console.error(result.error());
            else
                console.info(result.data());
        });

        BX24.installFinish();
    });
});

BX24.init(() => {
    const button = document.getElementById('unbind');

    button.addEventListener('click', function() {
        BX24.callMethod('placement.get', {},(result) => {
            result.data().forEach( (res) => {
                BX24.callMethod('placement.unbind', {
                    PLACEMENT: "CRM_LEAD_DETAIL_TAB",
                    TITLE: "Виджет",
                    HANDLER: res.handler
                }, (result) => {
                    console.log(result);
                });
            })
        });
    });
})