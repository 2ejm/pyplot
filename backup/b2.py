import pandas as pd
import matplotlib.pyplot as plt
import os
from datetime import datetime
import matplotlib.dates as mdates
from tkinter import filedialog, Tk

def bcd_to_float(bytes_list, decimal_places=2):
    if not bytes_list or len(bytes_list) == 0: return 0
    val = 0
    for b in bytes_list:
        digit = ((b >> 4) * 10) + (b & 0x0F)
        val = val * 100 + digit
    return val / (10 ** decimal_places)

def parse_packet(hex_list):
    try:
        if len(hex_list) < 40: return None
        return {
            "AIR_TEMP": bcd_to_float(hex_list[5:7], 2),   
            "HUMIDITY": bcd_to_float(hex_list[7:9], 2),    
            "SKIN1_TEMP": bcd_to_float(hex_list[9:11], 2),  
            "SKIN2_TEMP": bcd_to_float(hex_list[11:13], 2),  
            "OXYGEN" : bcd_to_float(hex_list[13:15], 2),  
            "AIR_HT_LVL": hex_list[17],  
            "WARM_HT_LVL": hex_list[18],     
            "AIR_HT_PT100": bcd_to_float(hex_list[20:22], 1),   
            "HUMI_HT_PT100": bcd_to_float(hex_list[22:24], 1),
            "ALARM_SEQ": hex_list[33], 
            "ALARM_CODE1": hex_list[34],
            "ALARM_CODE2": hex_list[35],            
        }
    except: return None

def select_file():
    root = Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="로그 파일을 선택하세요",
        filetypes=(("Text files", "*.txt"), ("All files", "*.*"))
    )
    root.destroy()
    return file_path

def main(sample_rate=3):
    file_path = select_file()
    if not file_path: return

    parsed_results = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or ',"' not in line: continue
            try:
                time_str, raw_data = line.split(',"', 1)
                timestamp = datetime.strptime(time_str, '%H:%M:%S').replace(year=2022, month=2, day=21)
                
                # [수정] replace 대신 슬라이싱으로 데이터 유실 방지
                # "02, ... ,03" 형태에서 따옴표와 마지막 ,03만 제거
                content = raw_data.strip()
                if content.endswith('"'): content = content[:-1] # 마지막 따옴표 제거
                if content.endswith(',03'): content = content[:-3] # 마지막 ETX 제거
                
                raw_bytes = [int(h, 16) for h in content.split(',') if h.strip()]
                
                res = parse_packet(raw_bytes)
                if res:
                    res['TIME'] = timestamp
                    parsed_results.append(res)
            except: continue

    df = pd.DataFrame(parsed_results)
    if df.empty: return
    df.set_index('TIME', inplace=True)

    alarm_df = df[(df['ALARM_SEQ'] == 0) | (df['ALARM_CODE1'] != 0) | (df['ALARM_CODE2'] != 0)]
    
    alarm_summary = " [ ALARM LOG (HEX) ]\n" + "-"*30 + "\n"
    alarm_summary += "  TIME    SEQ   C1    C2\n"
    alarm_summary += "-"*30 + "\n"
    
    if not alarm_df.empty:
        # 값이 변하는 시점만 필터링 (너무 많은 중복 방지)
        summary_data = alarm_df.drop_duplicates(subset=['ALARM_SEQ', 'ALARM_CODE1', 'ALARM_CODE2']).tail(18)
        
        for t, row in summary_data.iterrows():
            time_txt = t.strftime('%H:%M:%S')
            # 16진수 2자리 포맷(0x00)으로 변환
            seq_hex = f"0x{int(row['ALARM_SEQ']):02X}"
            c1_hex  = f"0x{int(row['ALARM_CODE1']):02X}"
            c2_hex  = f"0x{int(row['ALARM_CODE2']):02X}"
            alarm_summary += f"{time_txt}  {seq_hex}  {c1_hex}  {c2_hex}\n"
    else:
        alarm_summary += "       NO ALARMS DETECTED\n"

    if sample_rate > 1:
        df_plot = df.iloc[::sample_rate]
    else:
        df_plot = df

    if sample_rate > 1: df = df.iloc[::sample_rate]

    fig, ax1 = plt.subplots(figsize=(15, 10))
    ax2 = ax1.twinx()

    lines = []
    lines.append(ax1.plot(df.index, df['AIR_TEMP'], label='Air Temp', color='red', lw=1.2)[0])
    lines.append(ax1.plot(df.index, df['SKIN1_TEMP'], label='Skin1 Temp', color='orange', lw=1.2)[0])
    lines.append(ax1.plot(df.index, df['SKIN2_TEMP'], label='Skin2 Temp', color='brown', lw=1.2)[0])
    lines.append(ax2.plot(df.index, df['AIR_HT_PT100'], label='Air HT PT100', color='magenta', lw=1)[0])
    lines.append(ax2.plot(df.index, df['HUMI_HT_PT100'], label='Humi HT PT100', color='purple', lw=1)[0])

    lines.append(ax2.plot(df.index, df['HUMIDITY'], label='Humidity', color='blue', lw=1.2, ls='--')[0])
    lines.append(ax1.plot(df.index, df['OXYGEN'], label='Oxygen', color='green', lw=1.2, ls='--')[0])
    lines.append(ax2.plot(df.index, df['AIR_HT_LVL'], label='Air HT Lvl', color='skyblue', lw=1)[0])
    lines.append(ax2.plot(df.index, df['WARM_HT_LVL'], label='Warm HT Lvl', color='gray', lw=1)[0])

    # --- 알람 텍스트 박스 추가 (우측 상단 고정) ---
    plt.text(1.05, 0.6, alarm_summary, transform=ax1.transAxes, 
             verticalalignment='top', bbox=dict(boxstyle='round', facecolor='linen', alpha=0.8),
             fontsize=9, color='red', family='monospace')

    ax1.set_ylim(20, 50)
    ax2.set_ylim(0, 110)
    ax1.set_ylabel('Temperature (℃)')
    ax2.set_ylabel('Level / Humidity / O2 (%)')

    labels = [l.get_label() for l in lines]
    leg = ax2.legend(lines, labels, loc='upper left', bbox_to_anchor=(1.05, 1), 
                     fancybox=True, shadow=True, fontsize='small')
    plt.subplots_adjust(right=0.82) 

    lined = {}
    for legtext, origline in zip(leg.get_texts(), lines):
        legtext.set_picker(True)
        lined[legtext] = origline

    def on_pick(event):
        origline = lined[event.artist]
        visible = not origline.get_visible()
        origline.set_visible(visible)
        if visible: event.artist.set_alpha(1.0)
        else: event.artist.set_alpha(0.3)
        fig.canvas.draw_idle()

    fig.canvas.mpl_connect('pick_event', on_pick)

    annot = ax1.annotate("", xy=(0.98, 0.02), xycoords='axes fraction',
                        xytext=(0, 0), textcoords="offset points",
                        va="bottom", ha="right",
                        bbox=dict(fc="white", alpha=0.9, ec="gray", lw=1, boxstyle="round,pad=0.5"),
                        animated=True, fontsize=10, family='monospace')

    bg = None
    last_idx = None

    def on_draw(event):
        nonlocal bg
        annot.set_visible(False)
        bg = fig.canvas.copy_from_bbox(fig.bbox)

    def on_move(event):
        nonlocal bg, last_idx
        if event.inaxes in [ax1, ax2] and bg:
            try:
                x_dt = mdates.num2date(event.xdata).replace(tzinfo=None)
                idx = df.index.get_indexer([x_dt], method='nearest')[0]
            except: return
            if idx == last_idx: return
            last_idx = idx
            fig.canvas.restore_region(bg)
            row = df.iloc[idx]
            curr_time = df.index[idx].strftime('%H:%M:%S')
            
            # 마우스 오버 텍스트에 현재 시점의 알람 코드도 추가
            text = (f" [ {curr_time} ] \n"
                    f"------------------------\n"
                    f"AIR TEMP     : {row['AIR_TEMP']:>5.1f}℃\n"
                    f"SKIN1        : {row['SKIN1_TEMP']:>5.1f}℃\n"
                    f"SKIN2        : {row['SKIN2_TEMP']:>5.1f}℃\n"
                    f"HUMIDITY     : {row['HUMIDITY']:>5.1f}%\n"
                    f"OXYGEN       : {row['OXYGEN']:>5.1f}%\n"
                    f"AIR HT LVL   : {row['AIR_HT_LVL']:>5.0f}%\n"
                    f"AirHT PT100  : {row['AIR_HT_PT100']:>5.1f}℃\n"
                    f"HumiHT PT100 : {row['HUMI_HT_PT100']:>5.1f}℃")

            annot.set_text(text)
            annot.set_visible(True)
            ax1.draw_artist(annot)
            fig.canvas.blit(fig.bbox)
        else:
            if annot.get_visible():
                annot.set_visible(False)
                fig.canvas.draw_idle()

    fig.canvas.mpl_connect("motion_notify_event", on_move)
    fig.canvas.mpl_connect("draw_event", on_draw)

    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
    plt.xticks(rotation=45)
    plt.show()

if __name__ == "__main__":
    main(sample_rate=3)