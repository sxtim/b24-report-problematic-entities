<template>
	<div>
		<v-data-table
			v-model:items-per-page="itemsPerPage"
			v-model:page="currentPage"
			:headers="headers"
			:items="dealData"
			:loading="isLoading"
			class="elevation-1"
			item-value="id"
			:items-per-page-options="itemsPerPageOptions"
			hide-default-footer
			hover
		>
			<template v-slot:item.title="{ item }">
				<a href="#" @click.prevent="openDealCard(item.id)" class="entity-link">
					{{ item.title }}
				</a>
			</template>
			<template v-slot:item.problems="{ item }">
				<v-chip
					v-for="(problem, index) in item.problems"
					:key="index"
					class="mr-1 mb-1"
					color="error"
					size="small"
					variant="outlined"
				>
					{{ problem }}
				</v-chip>
			</template>
			<template v-slot:loading>
				<v-skeleton-loader type="table-row@5"></v-skeleton-loader>
			</template>

			<template v-slot:bottom>
				<div class="d-flex align-center pa-2 pagination-controls">
					<div class="text-caption">Всего: {{ dealData.length }}</div>
					<v-spacer></v-spacer>
					<div class="d-flex align-center">
						<span class="text-caption mr-2">Строк на странице:</span>
						<v-select
							v-model="itemsPerPage"
							:items="itemsPerPageOptions"
							density="compact"
							variant="outlined"
							hide-details
							style="max-width: 100px"
							class="mr-4"
						></v-select>
						<v-pagination
							v-model="currentPage"
							:length="pageCount"
							:total-visible="7"
						></v-pagination>
					</div>
				</div>
			</template>
		</v-data-table>

		<!-- Summary Information -->
		<v-card-text class="pa-2 mt-4">
			<v-row justify="end" class="font-weight-bold">
				<v-col cols="auto"
					>Общий итог: {{ dealData.length }} проблемных сделок</v-col
				>
			</v-row>
		</v-card-text>
	</div>
</template>

<script setup>
import { computed, inject, ref, watch } from "vue"
import { executeBatchRequest, fetchEntities } from "../../../utils/bx24Api"

const props = defineProps({
	filters: {
		type: Object,
		default: () => ({}),
	},
	loading: {
		type: Boolean,
		default: false,
	},
})

// BX24 API
const BX24 = inject("BX24")

// Table state
const itemsPerPage = ref(10)
const currentPage = ref(1)
const itemsPerPageOptions = [
	{ value: 10, title: "10" },
	{ value: 25, title: "25" },
	{ value: 50, title: "50" },
]
const isLoading = ref(false)
const dealData = ref([])

// Pagination computed property
const pageCount = computed(() => {
	return Math.ceil(dealData.value.length / itemsPerPage.value)
})

// Columns for data table
const headers = ref([
	{
		title: "Название сделки",
		key: "title",
		align: "start",
		sortable: true,
	},
	{
		title: "Проблемы",
		key: "problems",
		align: "start",
		sortable: false,
	},
])

// Open deal card in Bitrix24
const openDealCard = dealId => {
	if (BX24) {
		BX24.openPath(`/crm/deal/details/${dealId}/`)
	}
}

// Load deal data
const loadData = async () => {
	isLoading.value = true

	try {
		// Загрузка сделок с учетом фильтров
		const dealFilter = { ...props.filters }

		const deals = await fetchEntities(BX24, "crm.deal.list", {
			select: ["ID", "TITLE", "COMPANY_ID"],
			filter: dealFilter,
		})

		if (deals.length === 0) {
			dealData.value = []
			isLoading.value = false
			return
		}

		// Получаем все контакты для всех сделок
		const dealIds = deals.map(d => d.ID)
		const batchSize = 50
		const allDealContactLinks = {}

		for (let i = 0; i < dealIds.length; i += batchSize) {
			const chunkIds = dealIds.slice(i, i + batchSize)
			const contactCheckBatch = {}
			chunkIds.forEach(id => {
				contactCheckBatch[`c_${id}`] = {
					method: "crm.deal.contact.items.get",
					params: { id },
				}
			})
			const chunkResults = await executeBatchRequest(BX24, contactCheckBatch)
			Object.assign(allDealContactLinks, chunkResults)
		}
		const dealContactLinks = allDealContactLinks

		// Собираем уникальные ID контактов
		const contactIds = [
			...new Set(
				Object.values(dealContactLinks)
					.flat()
					.map(item => item.CONTACT_ID)
			),
		]

		let contactsWithCompanies = []
		if (contactIds.length > 0) {
			contactsWithCompanies = await fetchEntities(BX24, "crm.contact.list", {
				select: ["ID", "COMPANY_ID"],
				filter: { ID: contactIds },
			})
		}

		const contactCompanyMap = contactsWithCompanies.reduce((acc, contact) => {
			acc[contact.ID] = contact.COMPANY_ID
			return acc
		}, {})

		// Проверка на проблемы в сделках
		const problemDeals = deals
			.map(deal => {
				const problems = []
				const dealContacts = dealContactLinks[`c_${deal.ID}`] || []

				// 1. Проверяем привязку контакта
				if (dealContacts.length === 0) {
					problems.push("Не привязан контакт")
				}

				// 2. Проверяем привязку компании
				let hasCompany = !!deal.COMPANY_ID && deal.COMPANY_ID !== "0"
				if (!hasCompany) {
					// Проверяем компанию через контакты
					const hasCompanyThroughContact = dealContacts.some(
						contact => !!contactCompanyMap[contact.CONTACT_ID]
					)
					if (hasCompanyThroughContact) {
						hasCompany = true
					}
				}

				if (!hasCompany) {
					problems.push("Не привязана компания")
				}

				// Если есть проблемы, добавляем сделку в список
				if (problems.length > 0) {
					return {
						id: deal.ID,
						title: deal.TITLE,
						problems: problems,
					}
				}

				return null
			})
			.filter(deal => deal !== null)

		dealData.value = problemDeals
	} catch (error) {
		console.error("Error loading deal data:", error)
	} finally {
		isLoading.value = false
	}
}

// Watch for filter changes
watch(
	() => props.filters,
	() => {
		loadData()
	},
	{ deep: true, immediate: true }
)
</script>

<style scoped>
.entity-link {
	color: #2196f3;
	text-decoration: none;
}
.entity-link:hover {
	text-decoration: underline;
}
</style>
