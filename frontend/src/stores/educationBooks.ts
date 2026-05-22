import { defineStore } from "pinia";
import { ref } from "vue";
import type { EducationBook } from "@careercenter/shared";
import { api } from "../api/index.js";
import type { EducationBookPayload } from "../types/index.js";

export const useEducationBooksStore = defineStore("educationBooks", () => {
  const books = ref<EducationBook[]>([]);
  const newBook = ref<EducationBookPayload>({
    title: "",
    author: "",
    status: "planned",
    url: "",
    notes: "",
    sortOrder: 0
  });

  async function loadBooks() {
    books.value = await api.educationBooks();
  }

  async function addBook() {
    const payload: EducationBookPayload = {
      ...newBook.value,
      author: newBook.value.author || undefined,
      url: newBook.value.url || undefined,
      sortOrder: books.value.length
    };
    const created = await api.createEducationBook(payload);
    books.value.push(created);
    newBook.value = {
      title: "",
      author: "",
      status: "planned",
      url: "",
      notes: "",
      sortOrder: 0
    };
  }

  async function removeBook(id: string) {
    await api.deleteEducationBook(id);
    books.value = books.value.filter((book) => book.id !== id);
  }

  return { books, newBook, loadBooks, addBook, removeBook };
});
