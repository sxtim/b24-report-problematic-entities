<template>
	<v-card>
		<v-card-title>Анализ текущей сущности</v-card-title>
		<v-card-text>
			<div v-if="isLoading" class="text-center">
				<v-progress-circular
					indeterminate
					color="primary"
				></v-progress-circular>
				<p class="mt-2">Загрузка данных...</p>
			</div>
			<v-alert v-else-if="error" type="error" density="compact">
				{{ error }}
			</v-alert>
			<div v-else>
				<p class="text-h6 mb-3">
					Проблемы, найденные в:
					<strong
						><a href="#" @click.prevent="openEntityCard" class="entity-link">{{
							entityTitle
						}}</a></strong
					>
				</p>
				<v-list lines="one" v-if="problems.length > 0">
					<v-list-item
						v-for="(problem, index) in problems"
						:key="index"
						prepend-icon="mdi-alert-circle-outline"
					>
						<v-list-item-title>{{ problem }}</v-list-item-title>
					</v-list-item>
				</v-list>
				<v-alert v-else type="success" density="compact">
					Проблем не найдено. Все ключевые поля заполнены.
				</v-alert>
			</div>
		</v-card-text>
	</v-card>
</template>

<script setup>
import { inject, onMounted, ref } from "vue"
import { callBX24Method } from "../utils/bx24Api.js"

const props = defineProps({
	placementInfo: {
		type: Object,
		required: true,
	},
})

const BX24 = inject("BX24")
const isLoading = ref(true)
const error = ref(null)
const problems = ref([])
const entityTitle = ref("")
const entityId = ref(null)
const entityType = ref("")

const placementToApiMap = {
	CRM_DEAL_DETAIL_TAB: {
		method: "crm.deal.get",
		path: "/crm/deal/details/",
		type: "deal",
	},
	CRM_COMPANY_DETAIL_TAB: {
		method: "crm.company.get",
		path: "/crm/company/details/",
		type: "company",
	},
	CRM_CONTACT_DETAIL_TAB: {
		method: "crm.contact.get",
		path: "/crm/contact/details/",
		type: "contact",
	},
}

onMounted(async () => {
	if (!props.placementInfo || !props.placementInfo.options.ID) {
		error.value = "Не удалось определить контекст сущности."
		isLoading.value = false
		return
	}

	const placement = props.placementInfo.placement
	const apiInfo = placementToApiMap[placement]

	if (!apiInfo) {
		error.value = `Неизвестный тип размещения: ${placement}`
		isLoading.value = false
		return
	}

	entityId.value = props.placementInfo.options.ID
	entityType.value = apiInfo.type

	try {
		const response = await callBX24Method(BX24, apiInfo.method, {
			id: entityId.value,
		})
		const entity = response.data[0]
		entityTitle.value =
			entity.TITLE || `${entity.NAME || ""} ${entity.LAST_NAME || ""}`

		await checkForProblems(entity, apiInfo.type)
	} catch (e) {
		console.error("Ошибка при загрузке данных сущности:", e)
		error.value = "Не удалось загрузить данные сущности."
	} finally {
		isLoading.value = false
	}
})

const checkForProblems = async (entity, type) => {
	const foundProblems = []

	if (type === "deal") {
		const contacts = await callBX24Method(BX24, "crm.deal.contact.items.get", {
			id: entity.ID,
		})
		if (!contacts.data || contacts.data.length === 0) {
			foundProblems.push("Не привязан контакт")
		}
		if (!entity.COMPANY_ID || entity.COMPANY_ID === "0") {
			foundProblems.push("Не привязана компания")
		}
	}

	if (type === "company") {
		if (!entity.ADDRESS) foundProblems.push("Не заполнен адрес")
		if (!entity.PHONE || entity.PHONE.length === 0)
			foundProblems.push("Не указан телефон")
		const requisites = await callBX24Method(BX24, "crm.requisite.list", {
			filter: { ENTITY_TYPE_ID: 4, ENTITY_ID: entity.ID },
		})
		if (!requisites.data || requisites.data.length === 0) {
			foundProblems.push("Не заполнены реквизиты")
		}
	}

	if (type === "contact") {
		if (!entity.ADDRESS) foundProblems.push("Не заполнен адрес")
		if (!entity.PHONE || entity.PHONE.length === 0)
			foundProblems.push("Не указан телефон")
		if (!entity.EMAIL || entity.EMAIL.length === 0)
			foundProblems.push("Не указан Email")
	}

	problems.value = foundProblems
}

const openEntityCard = () => {
	const apiInfo = placementToApiMap[props.placementInfo.placement]
	if (BX24 && apiInfo) {
		BX24.openPath(`${apiInfo.path}${entityId.value}/`)
	}
}
</script>

<style scoped>
.entity-link {
	text-decoration: none;
	border-bottom: 1px dashed;
	color: inherit;
}
.entity-link:hover {
	border-bottom: 1px solid;
}
</style>
