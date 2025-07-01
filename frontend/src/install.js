import { initBX24 } from "./utils/bx24"

const PLACEMENTS = [
	{
		placement: "CRM_DEAL_DETAIL_TAB",
		title: "Проблемные сущности",
	},
	{
		placement: "CRM_COMPANY_DETAIL_TAB",
		title: "Проблемные сущности",
	},
	{
		placement: "CRM_CONTACT_DETAIL_TAB",
		title: "Проблемные сущности",
	},
]

function installPlacements() {
	initBX24().then(bx24 => {
		const handlerUrl = window.location.href.replace(
			/index\.html.*$/,
			"widget.html"
		)

		const batchCommands = PLACEMENTS.map((p, index) => ({
			key: `placement_bind_${index}`,
			method: "placement.bind",
			params: {
				PLACEMENT: p.placement,
				HANDLER: handlerUrl,
				TITLE: p.title,
				DESCRIPTION: "Отчет по проблемным сущностям",
			},
		}))

		bx24.callBatch(batchCommands, result => {
			console.log("Результаты установки встроек:")
			Object.values(result).forEach(res => {
				if (res.error()) {
					console.error("Ошибка установки:", res.error())
				} else {
					console.log("Успешно:", res.data())
				}
			})
		})
	})
}

// Запускаем установку
installPlacements()
