<script setup>
defineProps({
    title: {
        type: String,
        default: null
    }
});
</script>

<template>
    <h3>{{ title }}</h3>
</template>