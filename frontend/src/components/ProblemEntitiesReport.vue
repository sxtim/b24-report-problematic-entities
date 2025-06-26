<template>
	<v-card>
		<v-card-title class="pb-4 d-flex align-center">
			Поиск проблемных сущностей
			<v-icon class="ml-2" size="small" @click="faqDialog = true">
				mdi-information-outline
			</v-icon>
		</v-card-title>
		<v-card-text>
			<!-- Filters -->
			<v-row align="center">
				<v-col cols="12" sm="6" md="3">
					<v-select
						label="Тип сущности"
						:items="entityTypes"
						v-model="selectedEntityType"
						item-title="title"
						item-value="value"
						variant="outlined"
						density="comfortable"
					></v-select>
				</v-col>
				<v-col cols="12" sm="12" md="3" style="max-width: 360px">
					<v-date-input
						v-model="dateRange"
						label="Период"
						multiple="range"
						variant="outlined"
						density="comfortable"
						clearable
						locale="ru"
						style="max-width: 360px"
						prepend-inner-icon="mdi-calendar"
						prepend-icon=""
						autocomplete="off"
						placeholder=" "
					></v-date-input>
				</v-col>
				<v-col cols="12" sm="12" md="3" style="max-width: 360px">
					<v-btn
						color="primary"
						@click="applyFilter"
						:disabled="!dateRange.length"
					>
						Применить
					</v-btn>
				</v-col>
			</v-row>

			<!-- Отчет в зависимости от выбранного типа сущности -->
			<CompanyReport
				v-if="selectedEntityType === 'companies'"
				:filters="filters"
				:loading="loading"
			/>
			<ContactReport
				v-else-if="selectedEntityType === 'contacts'"
				:filters="filters"
				:loading="loading"
			/>
			<DealReport
				v-else-if="selectedEntityType === 'deals'"
				:filters="filters"
				:loading="loading"
			/>
			<v-alert v-else type="info" density="compact" class="mt-4">
				Выберите тип сущности для отображения отчета
			</v-alert>
		</v-card-text>

		<v-alert v-if="error" type="error" density="compact">
			{{ error }}
		</v-alert>

		<v-dialog v-model="faqDialog" max-width="600px">
			<v-card>
				<v-card-title>
					<span class="text-h5">Справка по работе с отчетом</span>
				</v-card-title>
				<v-card-text>
					<p>
						Этот отчет предназначен для поиска сущностей с отсутствующими
						данными.
					</p>
					<br />
					<p><strong>Проверяемые поля:</strong></p>
					<ul>
						<li>
							<strong>Для компании:</strong>
							<ul>
								<li>Адрес</li>
								<li>Реквизиты</li>
								<li>Телефон</li>
								<li>Привязанный контакт</li>
							</ul>
						</li>
						<li>
							<strong>Для контакта:</strong>
							<ul>
								<li>Адрес</li>
								<li>Реквизиты</li>
								<li>Телефон</li>
								<li>Email</li>
							</ul>
						</li>
						<li>
							<strong>Для сделки:</strong>
							<ul>
								<li>Привязанный контакт</li>
								<li>Привязанная компания</li>
							</ul>
						</li>
					</ul>
					<br />
					<p><strong>Показатели:</strong></p>
					<ul>
						<li>
							<strong>Название сущности:</strong> Тип проблемной сущности.
						</li>
						<li>
							<strong>Заголовок элемента:</strong> Название сущности с
							возможностью перехода в карточку.
						</li>
						<li>
							<strong>Перечень проблем:</strong> Список отсутствующих данных.
						</li>
					</ul>
					<br />
					<p><strong>Фильтры:</strong></p>
					<ul>
						<li>
							<strong>Тип сущности:</strong> Выберите тип сущности для анализа
							(компании, контакты или сделки).
						</li>
						<li>
							<strong>Период:</strong> Укажите диапазон дат создания сущностей.
						</li>
					</ul>
					<br />
					<p><strong>Интерактивные элементы:</strong></p>
					<ul>
						<li>
							<strong>Заголовок сущности:</strong> Клик по заголовку откроет
							соответствующую карточку в Битрикс24.
						</li>
					</ul>
					<br />
					<p>
						Отчет обновляется автоматически при изменении любого из фильтров.
					</p>
				</v-card-text>
				<v-card-actions>
					<v-spacer></v-spacer>
					<v-btn color="primary" text @click="faqDialog = false">Закрыть</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-card>
</template>

<script setup>
import { computed, inject, ref } from "vue"
import CompanyReport from "./reports/problem-entities/CompanyReport.vue"
import ContactReport from "./reports/problem-entities/ContactReport.vue"
import DealReport from "./reports/problem-entities/DealReport.vue"

// --- Helper Functions ---
const formatDate = dateString => {
	const date = new Date(dateString)
	return date.toLocaleDateString("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	})
}

// --- State ---
const loading = ref(false)
const error = ref(null)
const BX24 = inject("BX24")

// Filters
const selectedEntityType = ref("companies")
const dateRange = ref([])
const appliedDateRange = ref([]) // Фактически примененный диапазон дат
const faqDialog = ref(false)

// Опции для селектов
const entityTypes = [
	{ title: "Компании", value: "companies" },
	{ title: "Контакты", value: "contacts" },
	{ title: "Сделки", value: "deals" },
]

// Метод для применения фильтра по дате
const applyFilter = () => {
	appliedDateRange.value = [...dateRange.value]
}

// Общие фильтры для передачи в дочерние компоненты
const filters = computed(() => {
	const filterObj = {}

	if (appliedDateRange.value && appliedDateRange.value.length > 0) {
		// Для диапазона дат
		if (appliedDateRange.value.length > 1) {
			const startDate = new Date(appliedDateRange.value[0])
			startDate.setHours(0, 0, 0, 0)

			const endDate = new Date(
				appliedDateRange.value[appliedDateRange.value.length - 1]
			)
			endDate.setHours(23, 59, 59, 999)

			filterObj[">=DATE_CREATE"] = startDate.toISOString()
			filterObj["<=DATE_CREATE"] = endDate.toISOString()
		}
		// Для одной даты
		else {
			const singleDate = new Date(appliedDateRange.value[0])
			const startOfDay = new Date(singleDate)
			startOfDay.setHours(0, 0, 0, 0)
			const endOfDay = new Date(singleDate)
			endOfDay.setHours(23, 59, 59, 999)

			filterObj[">=DATE_CREATE"] = startOfDay.toISOString()
			filterObj["<=DATE_CREATE"] = endOfDay.toISOString()
		}
	}

	return filterObj
})
</script>

<style>
.date-picker-field {
	max-width: 360px;
}
.v-btn.v-btn--density-default {
	margin-bottom: 14px;
}
</style>
