import { CATEGORIES } from "../domain/constants";
import { round } from "../domain/tracker";
import type { TrackerController } from "../hooks/useTrackerController";
import { CategoryWheel } from "./CategoryWheel";
import { FoodCard } from "./FoodCard";
import "./FoodScreen.css";

export function FoodScreen({ controller: c }: { controller: TrackerController }) {
    return <div className="food-screen">
        {c.selectedCategory === null ? <section className="category-section">
            <CategoryWheel onSelect={c.openFoodCategory}/>
        </section> : <>
            <div className="category-header">
                <button className="back-button" onClick={c.closeFoodCategory}>← Kategorije</button>
                <div>
                    <span className="eyebrow">OTVORENO</span>
                    <h2>{c.selectedCategory === "common" ? "Osnovno" : CATEGORIES.find((category) => category.id === c.selectedCategory)?.name}</h2>
                </div>
            </div>

            {c.categoryFoods.length > 0 ? <div className="food-list">
                {c.categoryFoods.map((food) => <FoodCard
                    key={food.id}
                    food={food}
                    selectedAmount={c.draft.foods.find((item) => item.foodId === food.id)?.amount}
                    common={c.commonFoods.includes(food.id)}
                    pendingHide={c.pendingHideFoods.includes(food.id)}
                    onSelect={c.selectFood}
                    onCommon={c.toggleCommonFood}
                />)}
            </div> : <div className="card common-empty">
                {c.selectedCategory === "common" && c.commonFoods.length === 0
                    ? "Označi zvezdicom namirnice koje želiš u Osnovno."
                    : "U ovoj kategoriji nema vidljivih namirnica."}
            </div>}

            {c.todayFoods.length > 0 && <section className={`hidden-food-section ${c.showTodayFoods ? "open" : ""}`}>
                {/* Fix: This control represents the complete daily intake, not category-specific hidden/completed cards. */}
                <button
                    className={`hidden-food-toggle ${c.showTodayFoods ? "active" : ""}`}
                    onClick={() => c.setShowTodayFoods((current) => !current)}
                    aria-expanded={c.showTodayFoods}
                >
                    {c.showTodayFoods ? "Sakrij šta sam danas jeo" : `Šta sam danas jeo (${c.todayFoods.length})`}
                </button>
                {c.showTodayFoods && <div className="hidden-food-panel">
                    <div className="hidden-food-heading">
                        <span className="eyebrow">DANAŠNJI UNOS</span>
                        <strong>Sve što sam danas jeo</strong>
                    </div>
                    <div className="food-list">
                        {/* Feature: Every selected food is shown here regardless of the category currently open. */}
                        {c.todayFoods.map((food) => <FoodCard
                            key={food.id}
                            food={food}
                            selectedAmount={c.draft.foods.find((item) => item.foodId === food.id)?.amount}
                            common={c.commonFoods.includes(food.id)}
                            pendingHide={false}
                            onSelect={c.selectFood}
                            onCommon={c.toggleCommonFood}
                        />)}
                    </div>
                </div>}
            </section>}
        </>}

        <div className="food-totals">
            <strong>{round(c.nutrition.kcal).toLocaleString("sr-RS")} kcal</strong>
            <span>{round(c.nutrition.protein)} g proteina</span>
        </div>
    </div>;
}
