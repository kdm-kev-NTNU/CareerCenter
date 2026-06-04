---
name: test-coverage-strategy
description: Plan, write, and review tests at every level (unit, integration, e2e) across frontend and backend codebases to ensure high coverage. Use when the user asks to add tests, improve coverage, build a test plan, review test quality, or set up testing infrastructure for Vue/TypeScript, Java/Spring Boot, or Python/FastAPI projects.
---

# Test Coverage Strategy

Ensure high, meaningful test coverage across the full stack by applying the test pyramid, language-idiomatic patterns, and coverage enforcement.

## 1. Test Pyramid & Coverage Targets

| Level | Ratio | Scope | Speed |
|-------|-------|-------|-------|
| **Unit** | ~70 % of tests | Single function/class, mocked deps | < 50 ms each |
| **Integration** | ~20 % | Multiple components, real or embedded deps | < 5 s each |
| **E2E / Browser** | ~10 % | Full user flows through the running app | < 30 s each |

**Coverage gate targets (line coverage):**

| Layer | Minimum | Stretch |
|-------|---------|---------|
| Backend business logic | 80 % | 90 % |
| Frontend components + stores | 75 % | 85 % |
| Overall | 70 % | 80 % |

## 2. What to Test at Each Level

### Unit

- Pure functions, validators, transformers, utility helpers.
- Service/business logic with dependencies mocked or stubbed.
- State management (stores/reducers) in isolation.
- Edge cases: nulls, empty collections, boundary values, error paths.

### Integration

- API controller + service + repository wired together (use embedded DB or testcontainers).
- HTTP request/response serialization, status codes, error payloads.
- Security filters (auth, roles, rate limiting).
- Frontend composables/hooks that depend on API calls (MSW or similar mocks).

### E2E / Browser

- Critical user journeys only (login, submit form, navigate key pages).
- Smoke tests for deployment verification.
- Avoid duplicating logic already covered by unit/integration tests.

## 3. Language-Specific Guidance

### Vue 3 + TypeScript (Vitest + Cypress)

**Unit & component tests (Vitest + @vue/test-utils):**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from '@/components/MyComponent.vue'

describe('MyComponent', () => {
  it('renders slot content', () => {
    const wrapper = mount(MyComponent, {
      slots: { default: 'Hello' },
    })
    expect(wrapper.text()).toContain('Hello')
  })

  it('emits event on click', async () => {
    const wrapper = mount(MyComponent)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
```

**What to cover:**

- Component rendering with different props/slots.
- Emitted events and their payloads.
- Pinia stores: actions, getters, state mutations.
- Composables: return values and reactive behavior.
- Router guards and navigation logic.

**E2E (Cypress):**

```typescript
describe('Login flow', () => {
  it('logs in and reaches dashboard', () => {
    cy.visit('/')
    cy.get('[data-testid="email"]').type('user@example.com')
    cy.get('[data-testid="password"]').type('secret')
    cy.get('[data-testid="login-btn"]').click()
    cy.url().should('include', '/dashboard')
  })
})
```

**Coverage command:** `npx vitest run --coverage`

### Java 21 + Spring Boot (JUnit 5 + Mockito + JaCoCo)

**Unit tests:**

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repo;
    @InjectMocks OrderService service;

    @Test
    void calculate_total_applies_discount() {
        var order = new Order(List.of(item(100), item(200)));
        assertEquals(270, service.calculateTotal(order, 0.10));
    }

    @Test
    void reject_empty_order() {
        assertThrows(IllegalArgumentException.class,
            () -> service.calculateTotal(new Order(List.of()), 0));
    }
}
```

**Integration tests (Spring `@WebMvcTest` / `@SpringBootTest`):**

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mvc;
    @MockBean OrderService service;

    @Test
    void returns_404_for_missing_order() throws Exception {
        when(service.findById(99L)).thenReturn(Optional.empty());
        mvc.perform(get("/api/orders/99"))
           .andExpect(status().isNotFound());
    }
}
```

**What to cover:**

- Service logic with mocked repositories.
- Controller endpoints: happy path, validation errors, auth/forbidden.
- Security config: role-based access, CSRF, CORS.
- Custom validators and exception handlers.

**Coverage enforcement (pom.xml JaCoCo):**

```xml
<rule>
  <element>BUNDLE</element>
  <limit>
    <counter>LINE</counter>
    <value>COVEREDRATIO</value>
    <minimum>0.80</minimum>
  </limit>
</rule>
```

### Python 3.11+ / FastAPI (pytest + coverage.py)

**Unit tests:**

```python
import pytest
from myapp.services.calculator import calculate_discount

def test_discount_applied():
    assert calculate_discount(total=200, rate=0.1) == 180

def test_negative_rate_raises():
    with pytest.raises(ValueError):
        calculate_discount(total=200, rate=-0.5)
```

**Integration tests (FastAPI TestClient):**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from myapp.main import app

@pytest.mark.asyncio
async def test_create_item():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/items", json={"name": "Widget"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Widget"
```

**What to cover:**

- Pydantic model validation (valid + invalid payloads).
- Service functions with mocked DB sessions (`pytest-mock`).
- API endpoints: status codes, response schemas, auth headers.
- Async code paths with `pytest-asyncio`.
- Database migrations (Alembic up/down idempotency).

**Browser E2E (Selenium):**

```python
@pytest.mark.browser
def test_chat_sends_message(browser):
    browser.get("http://localhost:8000")
    input_el = browser.find_element(By.CSS_SELECTOR, "[data-testid='chat-input']")
    input_el.send_keys("Hello")
    input_el.send_keys(Keys.RETURN)
    WebDriverWait(browser, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".chat-response"))
    )
```

**Coverage command:** `pytest --cov=src --cov-report=term-missing --cov-fail-under=80`

## 4. Workflow: Adding Tests to Existing Code

1. **Identify gaps** — run coverage report, find uncovered files/branches.
2. **Prioritize** — start with business-critical paths, then error handling, then edge cases.
3. **Write unit tests first** — fast feedback, highest ROI.
4. **Add integration tests** for API boundaries and cross-component interactions.
5. **Add E2E tests** only for critical user journeys not already covered.
6. **Enforce in CI** — fail the build if coverage drops below the gate.

## 5. Test Quality Checklist

- [ ] Tests assert behavior, not implementation details.
- [ ] Each test has a single clear reason to fail.
- [ ] Test names describe the scenario and expected outcome.
- [ ] No test depends on execution order or shared mutable state.
- [ ] Mocks are minimal — only mock what crosses a boundary.
- [ ] Flaky tests are quarantined and fixed promptly.
- [ ] Coverage reports exclude generated code, DTOs, and config classes.
- [ ] Negative/error cases are tested, not just happy paths.

## 6. Additional Resources

For detailed patterns, fixtures, and advanced scenarios, see [reference.md](reference.md).
