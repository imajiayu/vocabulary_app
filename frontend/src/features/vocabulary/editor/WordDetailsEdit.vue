<template>
  <div>
    <div class="field-group">
      <label class="field-label">单词</label>
      <input
        :value="props.editData?.word ?? ''"
        @input="updateWord(($event.target as HTMLInputElement).value)"
        type="text"
        class="field-input"
      />
    </div>

    <div class="field-group">
      <label class="field-label">音标</label>
      <div class="phonetic-edit">
        <div class="phonetic-input-row">
          <label class="phonetic-label">美音</label>
          <input
            :value="props.editData?.definition?.phonetic?.us ?? ''"
            @input="updatePhonetic('us', ($event.target as HTMLInputElement).value)"
            type="text"
            class="field-input phonetic-input"
            placeholder="[əkˈseləreɪt]"
          />
        </div>
        <div class="phonetic-input-row">
          <label class="phonetic-label">英音</label>
          <input
            :value="props.editData?.definition?.phonetic?.uk ?? ''"
            @input="updatePhonetic('uk', ($event.target as HTMLInputElement).value)"
            type="text"
            class="field-input phonetic-input"
            placeholder="[əkˈseləreɪt]"
          />
        </div>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">释义</label>
      <div class="definitions-edit">
        <div
          v-for="(item, index) in props.editData?.definition?.definitions || []"
          :key="index"
          class="definition-edit-row"
        >
          <input
            :value="item ?? ''"
            @input="updateDefinition(index, ($event.target as HTMLInputElement).value)"
            type="text"
            class="field-input definition-input"
            :placeholder="`释义 ${index + 1}`"
          />
          <button @click="removeDefinition(index)" class="remove-button" type="button">
            <XIcon class="remove-icon" />
          </button>
        </div>
        <button @click="addDefinition" class="add-button" type="button">
          + 添加释义
        </button>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">例句</label>
      <div class="examples-edit">
        <div
          v-for="(item, index) in props.editData?.definition?.examples || []"
          :key="index"
          class="example-edit-item"
        >
          <div class="example-edit-row">
            <input
              :value="item.en ?? ''"
              @input="updateExample(index, 'en', ($event.target as HTMLInputElement).value)"
              type="text"
              class="field-input example-input"
              placeholder="English example"
            />
            <button @click="removeExample(index)" class="remove-button" type="button">
              <XIcon class="remove-icon" />
            </button>
          </div>
          <input
            :value="item.zh ?? ''"
            @input="updateExample(index, 'zh', ($event.target as HTMLInputElement).value)"
            type="text"
            class="field-input example-input"
            placeholder="中文翻译"
          />
        </div>
        <button @click="addExample" class="add-button" type="button">
          + 添加例句
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X as XIcon } from 'lucide-vue-next';
import type { Word } from '@/shared/types';

interface Props {
  editData?: Word;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:editData']);

const addDefinition = () => {
  if (props.editData?.definition) {
    const newDefinitions = [...(props.editData.definition.definitions || []), ''];
    emit('update:editData', {
      ...props.editData,
      definition: {
        ...props.editData.definition,
        definitions: newDefinitions,
      },
    });
  }
};

const removeDefinition = (index: number) => {
  if (props.editData?.definition?.definitions && props.editData.definition.definitions.length > 1) {
    const newDefinitions = [...props.editData.definition.definitions];
    newDefinitions.splice(index, 1);
    emit('update:editData', {
      ...props.editData,
      definition: {
        ...props.editData.definition,
        definitions: newDefinitions,
      },
    });
  }
};

const addExample = () => {
  if (props.editData?.definition) {
    const newExamples = [...(props.editData.definition.examples || []), { en: '', zh: '' }];
    emit('update:editData', {
      ...props.editData,
      definition: {
        ...props.editData.definition,
        examples: newExamples,
      },
    });
  }
};

const removeExample = (index: number) => {
  if (props.editData?.definition?.examples && props.editData.definition.examples.length > 1) {
    const newExamples = [...props.editData.definition.examples];
    newExamples.splice(index, 1);
    emit('update:editData', {
      ...props.editData,
      definition: {
        ...props.editData.definition,
        examples: newExamples,
      },
    });
  }
};

const updateWord = (value: string) => {
  if (props.editData) {
    emit('update:editData', { ...props.editData, word: value });
  }
};

const updatePhonetic = (type: 'us' | 'uk', value: string) => {
  if (props.editData?.definition) {
    const newPhonetic = {
      ...(props.editData.definition.phonetic),
      [type]: value,
    };
    emit('update:editData', {
      ...props.editData,
      definition: {
        ...props.editData.definition,
        phonetic: newPhonetic,
      },
    });
  }
};

const updateDefinition = (index: number, value: string) => {
  if (props.editData?.definition) {
    const newDefinitions = [...(props.editData.definition.definitions || [])];
    newDefinitions[index] = value;
    emit('update:editData', {
      ...props.editData,
      definition: {
        ...props.editData.definition,
        definitions: newDefinitions,
      },
    });
  }
};

const updateExample = (index: number, type: 'en' | 'zh', value: string) => {
  if (props.editData?.definition) {
    const newExamples = [...(props.editData.definition.examples || [])];
    newExamples[index] = {
      ...newExamples[index],
      [type]: value,
    };
    emit('update:editData', {
      ...props.editData,
      definition: {
        ...props.editData.definition,
        examples: newExamples,
      },
    });
  }
};
</script>

<style scoped>
.field-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.5rem;
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.5rem;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.5rem;
  transition: all 0.2s;
  font-size: 16px; /* 防止移动端自动缩放 */
  /* 移动端输入优化 */
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.field-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.phonetic-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.phonetic-input-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.phonetic-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  width: 3rem;
  flex-shrink: 0;
}

.phonetic-input {
  flex: 1;
}

.definitions-edit,
.examples-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.definition-edit-row,
.example-edit-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.definition-input,
.example-input {
  flex: 1;
}

.example-edit-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border-medium);
  border-radius: 0.5rem;
}

.remove-button {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--alert-error-bg);
  color: var(--color-danger);
  border-radius: 0.375rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-width: 44px;
  min-height: 44px;
}

.remove-button:hover {
  background: var(--primitive-brick-100);
}

.remove-icon {
  width: 1rem;
  height: 1rem;
}

.add-button {
  padding: 0.5rem 1rem;
  border: 1px dashed var(--color-border-strong);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* 移动端响应式适配 */
@media (max-width: 480px) {
  .field-group {
    margin-bottom: 1.25rem;
  }

  .field-label {
    font-size: 0.8125rem;
    margin-bottom: 0.375rem;
  }

  .field-input {
    padding: 0.75rem;
    min-height: 48px;
  }

  .phonetic-input-row {
    gap: 0.5rem;
  }

  .phonetic-label {
    width: 2.5rem;
    font-size: 0.6875rem;
  }

  .definitions-edit,
  .examples-edit {
    gap: 0.75rem;
  }

  .example-edit-item {
    padding: 1rem;
  }

  .remove-button {
    width: 2.5rem;
    height: 2.5rem;
    min-width: 2.5rem;
    min-height: 2.5rem;
  }

  .remove-icon {
    width: 1.125rem;
    height: 1.125rem;
  }

  .add-button {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    min-height: 48px;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .field-group {
    margin-bottom: 1rem;
  }

  .field-label {
    font-size: 0.75rem;
  }

  .field-input {
    padding: 0.875rem 0.75rem;
    min-height: 50px;
  }

  .phonetic-edit {
    gap: 0.75rem;
  }

  .phonetic-input-row {
    flex-direction: column;
    gap: 0.375rem;
    align-items: flex-start;
  }

  .phonetic-label {
    width: auto;
  }

  .example-edit-item {
    padding: 0.875rem;
  }

  .definition-edit-row,
  .example-edit-row {
    gap: 0.75rem;
  }

  .add-button {
    padding: 1rem;
    min-height: 50px;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .field-group {
    margin-bottom: 0.75rem;
  }

  .field-input {
    padding: 0.5rem 0.75rem;
    min-height: 36px;
  }

  .example-edit-item {
    padding: 0.5rem;
  }

  .remove-button {
    width: 2rem;
    height: 2rem;
    min-width: 2rem;
    min-height: 2rem;
  }

  .add-button {
    padding: 0.5rem 1rem;
    min-height: 36px;
  }
}
</style>