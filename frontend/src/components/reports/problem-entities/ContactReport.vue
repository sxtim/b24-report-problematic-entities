<template>
	<div>
		<v-data-table
			v-model:items-per-page="itemsPerPage"
			v-model:page="currentPage"
			:headers="headers"
			:items="contactData"
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
					@click.prevent="openContactCard(item.id)"
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
					<div class="text-caption">Всего: {{ contactData.length }}</div>
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
					>Общий итог: {{ contactData.length }} проблемных контактов</v-col
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
const contactData = ref([])
let loadRequestToken = 0 // Токен для отмены "устаревших" запросов

// Pagination computed property
const pageCount = computed(() => {
	return Math.ceil(contactData.value.length / itemsPerPage.value)
})

// Columns for data table
const headers = ref([
	{
		title: "ФИО контакта",
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

// Open contact card in Bitrix24
const openContactCard = contactId => {
	if (BX24) {
		BX24.openPath(`/crm/contact/details/${contactId}/`)
	}
}

// Load contact data
const loadData = async () => {
	loadRequestToken++
	const currentToken = loadRequestToken
	isLoading.value = true
	contactData.value = []
	let isFirstChunk = true

	try {
		const contactFilter = { ...props.filters }

		const processContactsChunk = async contacts => {
			if (currentToken !== loadRequestToken) return // Запрос устарел

			if (contacts.length === 0) {
				return
			}

			const contactIds = contacts.map(c => c.ID)
			const batchSize = 50
			const allRequisiteResults = {}

			// Пакетные запросы для реквизитов
			for (let i = 0; i < contactIds.length; i += batchSize) {
				const chunkIds = contactIds.slice(i, i + batchSize)
				const requisiteCheckBatch = {}
				chunkIds.forEach(id => {
					requisiteCheckBatch[`r_${id}`] = {
						method: "crm.requisite.list",
						params: {
							filter: { ENTITY_TYPE_ID: 3, ENTITY_ID: id },
						},
					}
				})
				const chunkResults = await executeBatchRequest(
					BX24,
					requisiteCheckBatch
				)
				Object.assign(allRequisiteResults, chunkResults)
			}

			const problemContacts = contacts
				.map(contact => {
					const problems = []
					if (!contact.ADDRESS || contact.ADDRESS.trim() === "") {
						problems.push("Нет адреса")
					}
					const contactRequisites = allRequisiteResults[`r_${contact.ID}`]
					if (!contactRequisites || contactRequisites.length === 0) {
						problems.push("Нет реквизитов")
					}
					if (!contact.PHONE || contact.PHONE.length === 0) {
						problems.push("Нет телефона")
					}
					if (!contact.EMAIL || contact.EMAIL.length === 0) {
						problems.push("Нет email")
					}

					if (problems.length > 0) {
						return {
							id: contact.ID,
							title: `${contact.NAME} ${contact.LAST_NAME}`.trim(),
							problems: problems,
						}
					}
					return null
				})
				.filter(contact => contact !== null)

			// Проверка токена перед добавлением данных
			if (currentToken !== loadRequestToken) return
			contactData.value.push(...problemContacts)

			if (isFirstChunk) {
				isLoading.value = false
				isFirstChunk = false
			}
		}

		await fetchEntities(BX24, "crm.contact.list", {
			select: ["ID", "NAME", "LAST_NAME", "ADDRESS", "PHONE", "EMAIL"],
			filter: contactFilter,
			onProgress: processContactsChunk,
		})
	} catch (error) {
		if (currentToken === loadRequestToken) {
			console.error("Error loading contact data:", error)
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
