<template>
	<v-app>
		<v-main>
			<WidgetReport v-if="isWidgetMode" :placement-info="props.placementInfo" />
			<ProblemEntitiesReport v-else />
		</v-main>
	</v-app>
</template>

<script setup>
import { computed, defineProps } from "vue"
import ProblemEntitiesReport from "./components/ProblemEntitiesReport.vue"
import WidgetReport from "./components/WidgetReport.vue"

const props = defineProps({
	placementInfo: {
		type: Object,
		default: null,
	},
})

const isWidgetMode = computed(() => !!props.placementInfo)
</script>

<style>
/* Global styles if needed */
</style>
