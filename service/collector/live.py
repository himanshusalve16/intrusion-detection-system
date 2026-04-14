# =====================================
# Generate Live Dataset
# =====================================

import pandas as pd
from pathlib import Path

print("Generating Live Dataset...")


# =====================================
# Fix Project Root
# =====================================

ROOT = Path(__file__).resolve().parents[2]

DATASET_PATH = ROOT / "data" / "UNSW_NB15_training-set.csv"

print("Loading Dataset From:")
print(DATASET_PATH)


# =====================================
# Load Dataset
# =====================================

if not DATASET_PATH.exists():
    print("Dataset Not Found")
    exit()

df = pd.read_csv(DATASET_PATH)

print("\nOriginal Dataset Shape:")
print(df.shape)


# =====================================
# Remove Weak Attacks
# =====================================

weak = [

    "Analysis",
    "Backdoor",
    "Shellcode",
    "Worms"

]

df = df[~df["attack_cat"].isin(weak)]


print("\nAfter Removing Weak Attacks")

print(df["attack_cat"].value_counts())


# =====================================
# Create Live Dataset (1000 Samples)
# =====================================

live_data = pd.concat([

    df[df["attack_cat"]=="Normal"].sample(200, random_state=42),
    df[df["attack_cat"]=="Generic"].sample(250, random_state=42),
    df[df["attack_cat"]=="Exploits"].sample(200, random_state=42),
    df[df["attack_cat"]=="Fuzzers"].sample(150, random_state=42),
    df[df["attack_cat"]=="DoS"].sample(100, random_state=42),
    df[df["attack_cat"]=="Reconnaissance"].sample(100, random_state=42)

])


# =====================================
# Shuffle Dataset
# =====================================

live_data = live_data.sample(frac=1, random_state=42)


# =====================================
# Display Distribution
# =====================================

print("\nLive Dataset Distribution:")

print(live_data["attack_cat"].value_counts())


# =====================================
# Save Dataset
# =====================================

SAVE_PATH = ROOT / "live_test_dataset.csv"

live_data.to_csv(SAVE_PATH, index=False)


print("\nLive Dataset Saved At:")

print(SAVE_PATH)


print("\nLive Dataset Generation Completed")