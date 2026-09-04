#include <iostream>
#include <optional>
#include <string>

int main() {
    // C++17: std::optional
    std::optional<std::string> greeting = "Hello from CompilerJudge sandbox!";

    if (greeting.has_value()) {
        std::cout << greeting.value() << std::endl;
    }

    // C++17: structured bindings
    auto [x, y] = std::make_pair(42, 3.14);
    std::cout << "C++17 works: x=" << x << ", y=" << y << std::endl;

    // C++17: if-init statement
    if (auto val = 2025; val > 2000) {
        std::cout << "Year: " << val << std::endl;
    }

    return 0;
}
