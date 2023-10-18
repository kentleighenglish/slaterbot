<script setup>
defineProps({
    engineData: {
        type: Object,
        default: () => ({})
    }
})
</script>
<template>
    <div>
        <h1>Slaterbot</h1>
        <DataDisplay title="Positions" />
        {{ engineData }}
    </div>
</template>