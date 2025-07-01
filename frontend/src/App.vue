<template>
	<v-app>
		<v-main>
			<ProblemEntitiesReport :placement-info="props.placementInfo" />
		</v-main>
	</v-app>
</template>

<script setup>
import { defineProps } from "vue"
import ProblemEntitiesReport from "./components/ProblemEntitiesReport.vue"

const props = defineProps({
	placementInfo: {
		type: Object,
		default: null,
	},
})
</script>

<style>
/* Global styles if needed */
</style>
