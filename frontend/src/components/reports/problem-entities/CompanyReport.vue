<template>
	<div>
		<v-data-table
			v-model:items-per-page="itemsPerPage"
			v-model:page="currentPage"
			:headers="headers"
			:items="companyData"
			:loading="isLoading"
			class="elevation-1"
			item-value="id"
			:items-per-page-options="itemsPerPageOptions"
			hide-default-footer
			hover
		>
			<template v-slot:item.title="{ item }">
				<a
					href="#"
					@click.prevent="openCompanyCard(item.id)"
					class="entity-link"
				>
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
					<div class="text-caption">Всего: {{ companyData.length }}</div>
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
					>Общий итог: {{ companyData.length }} проблемных компаний</v-col
				>
			</v-row>
		</v-card-text>
	</div>
</template>

<script setup>
import { computed, inject, ref, watch } from "vue"
import {
	callBX24Method,
	executeBatchRequest,
	fetchEntities,
} from "../../../utils/bx24Api"

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
const companyData = ref([])
let loadRequestToken = 0 // Токен для отмены "устаревших" запросов

// Pagination computed property
const pageCount = computed(() => {
	return Math.ceil(companyData.value.length / itemsPerPage.value)
})

// Columns for data table
const headers = ref([
	{
		title: "Название компании",
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

// Open company card in Bitrix24
const openCompanyCard = companyId => {
	if (BX24) {
		BX24.openPath(`/crm/company/details/${companyId}/`)
	}
}

// Load company data
const loadData = async () => {
	loadRequestToken++
	const currentToken = loadRequestToken
	isLoading.value = true
	companyData.value = []
	let isFirstChunk = true

	try {
		const companyFilter = { ...props.filters }

		// Widget logic: if a deal ID is passed, get the company from it first.
		if (companyFilter.DEAL_ID_FOR_COMPANY) {
			const dealId = companyFilter.DEAL_ID_FOR_COMPANY
			delete companyFilter.DEAL_ID_FOR_COMPANY

			const response = await callBX24Method(BX24, "crm.deal.get", {
				id: dealId,
			})
			const deal = response.data[0]

			if (deal && deal.COMPANY_ID) {
				companyFilter.ID = deal.COMPANY_ID
			} else {
				// If deal has no company, there's nothing to show.
				isLoading.value = false
				return
			}
		}

		const processCompaniesChunk = async companies => {
			if (currentToken !== loadRequestToken) return // Запрос устарел

			if (companies.length === 0) {
				return
			}

			const companyIds = companies.map(c => c.ID)
			const batchSize = 50
			const allContactResults = {}
			const allRequisiteResults = {}

			// Пакетные запросы для контактов
			for (let i = 0; i < companyIds.length; i += batchSize) {
				const chunkIds = companyIds.slice(i, i + batchSize)
				const contactCheckBatch = {}
				chunkIds.forEach(id => {
					contactCheckBatch[`c_${id}`] = {
						method: "crm.company.contact.items.get",
						params: { id },
					}
				})
				const chunkResults = await executeBatchRequest(BX24, contactCheckBatch)
				Object.assign(allContactResults, chunkResults)
			}

			// Пакетные запросы для реквизитов
			for (let i = 0; i < companyIds.length; i += batchSize) {
				const chunkIds = companyIds.slice(i, i + batchSize)
				const requisiteCheckBatch = {}
				chunkIds.forEach(id => {
					requisiteCheckBatch[`r_${id}`] = {
						method: "crm.requisite.list",
						params: {
							filter: { ENTITY_TYPE_ID: 4, ENTITY_ID: id },
						},
					}
				})
				const chunkResults = await executeBatchRequest(
					BX24,
					requisiteCheckBatch
				)
				Object.assign(allRequisiteResults, chunkResults)
			}

			const problemCompanies = companies
				.map(company => {
					const problems = []
					if (!company.ADDRESS || company.ADDRESS.trim() === "") {
						problems.push("Нет адреса")
					}
					const companyRequisites = allRequisiteResults[`r_${company.ID}`]
					if (!companyRequisites || companyRequisites.length === 0) {
						problems.push("Нет реквизитов")
					}
					if (!company.PHONE || company.PHONE.length === 0) {
						problems.push("Нет телефона")
					}
					const companyContacts = allContactResults[`c_${company.ID}`]
					if (!companyContacts || companyContacts.length === 0) {
						problems.push("Не привязан контакт")
					}

					if (problems.length > 0) {
						return {
							id: company.ID,
							title: company.TITLE,
							problems: problems,
						}
					}
					return null
				})
				.filter(company => company !== null)

			// Проверка токена перед добавлением данных
			if (currentToken !== loadRequestToken) return
			companyData.value.push(...problemCompanies)

			if (isFirstChunk) {
				isLoading.value = false
				isFirstChunk = false
			}
		}

		// Запускаем загрузку всех компаний с пошаговой обработкой
		await fetchEntities(BX24, "crm.company.list", {
			select: ["ID", "TITLE", "ADDRESS", "PHONE"],
			filter: companyFilter,
			onProgress: processCompaniesChunk,
		})
	} catch (error) {
		if (currentToken === loadRequestToken) {
			console.error("Error loading company data:", error)
		}
	} finally {
		if (currentToken === loadRequestToken) {
			isLoading.value = false
		}
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
